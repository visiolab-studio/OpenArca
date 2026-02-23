const fs = require("fs");
const express = require("express");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");
const { upload } = require("../middleware/uploads");
const {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  COMMENT_TYPES
} = require("../constants");
const {
  notifyReporterStatusChange,
  notifyReporterDeveloperComment
} = require("../services/notifications");
const { trackTelemetryEvent } = require("../services/telemetry");
const { ticketsService } = require("../services/tickets");

const router = express.Router();

const MAX_UPLOAD_BYTES_TOTAL = 20 * 1024 * 1024;

const listQuerySchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    project_id: z.string().uuid().optional(),
    my: z.enum(["0", "1"]).optional()
  })
  .strict();

const idParamsSchema = z.object({
  id: z.string().uuid()
});

const relatedParamsSchema = z.object({
  id: z.string().uuid(),
  relatedId: z.string().uuid()
});

const externalRefParamsSchema = z.object({
  id: z.string().uuid(),
  refId: z.string().uuid()
});

const createTicketSchema = z
  .object({
    title: z.string().min(10).max(300),
    description: z.string().min(50).max(20000),
    steps_to_reproduce: z.string().min(30).max(8000).optional(),
    expected_result: z.string().min(20).max(8000).optional(),
    actual_result: z.string().min(20).max(8000).optional(),
    environment: z.string().min(10).max(2000).optional(),
    urgency_reporter: z.enum(TICKET_PRIORITIES).default("normal"),
    category: z.enum(TICKET_CATEGORIES).default("other"),
    project_id: z.string().uuid().optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.category === "bug") {
      if (value.description.length < 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["description"],
          message: "For bugs, description must be at least 100 characters"
        });
      }
      for (const key of [
        "steps_to_reproduce",
        "expected_result",
        "actual_result",
        "environment"
      ]) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required for bug category`
          });
        }
      }
    }

    if (["feature", "improvement"].includes(value.category) && value.description.length < 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "For feature/improvement, description must be at least 100 characters"
      });
    }
  });

const developerPatchSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    planned_date: z.string().date().nullable().optional(),
    estimated_hours: z.coerce.number().min(0).max(10000).nullable().optional(),
    internal_note: z.string().max(10000).nullable().optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    order_index: z.coerce.number().int().min(0).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    project_id: z.string().uuid().nullable().optional(),
    title: z.string().min(10).max(300).optional(),
    description: z.string().min(50).max(20000).optional(),
    steps_to_reproduce: z.string().min(30).max(8000).nullable().optional(),
    expected_result: z.string().min(20).max(8000).nullable().optional(),
    actual_result: z.string().min(20).max(8000).nullable().optional(),
    environment: z.string().min(10).max(2000).nullable().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided"
  });

const userPatchSchema = z
  .object({
    title: z.string().min(10).max(300).optional(),
    description: z.string().min(50).max(20000).optional(),
    steps_to_reproduce: z.string().min(30).max(8000).optional(),
    expected_result: z.string().min(20).max(8000).optional(),
    actual_result: z.string().min(20).max(8000).optional(),
    environment: z.string().min(10).max(2000).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided"
  });

const createCommentSchema = z
  .object({
    content: z.string().trim().min(1).max(10000),
    is_internal: z.boolean().optional().default(false),
    is_closure_summary: z.boolean().optional().default(false),
    type: z.enum(COMMENT_TYPES).optional().default("comment"),
    parent_id: z.string().uuid().nullable().optional()
  })
  .strict();

const createRelationSchema = z
  .object({
    related_ticket_id: z.string().uuid().optional(),
    related_ticket_number: z.coerce.number().int().min(1).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasId = Boolean(value.related_ticket_id);
    const hasNumber = value.related_ticket_number != null;
    if (hasId === hasNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["related_ticket_id"],
        message: "Provide exactly one: related_ticket_id or related_ticket_number"
      });
    }
  });

const EXTERNAL_REFERENCE_TYPES = ["git_pr", "deployment", "monitoring", "other"];

const createExternalReferenceSchema = z
  .object({
    ref_type: z.enum(EXTERNAL_REFERENCE_TYPES),
    url: z.string().trim().url(),
    title: z.string().trim().max(300).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    const url = String(value.url || "").toLowerCase();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "URL must start with http:// or https://"
      });
    }
  });

const closureSummaryFeedQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    updated_since: z.string().trim().min(10).max(40).optional()
  })
  .strict();

function normalizeText(input) {
  if (typeof input !== "string") return undefined;
  const value = input.trim();
  return value.length ? value : undefined;
}

function parseCreateTicketBody(raw) {
  const normalized = {
    title: normalizeText(raw.title),
    description: normalizeText(raw.description),
    steps_to_reproduce: normalizeText(raw.steps_to_reproduce),
    expected_result: normalizeText(raw.expected_result),
    actual_result: normalizeText(raw.actual_result),
    environment: normalizeText(raw.environment),
    urgency_reporter: normalizeText(raw.urgency_reporter) || "normal",
    category: normalizeText(raw.category) || "other",
    project_id: normalizeText(raw.project_id)
  };

  return createTicketSchema.parse(normalized);
}

function removeUploadedFiles(files) {
  if (!Array.isArray(files)) return;
  for (const file of files) {
    if (file && file.path) {
      try {
        fs.unlinkSync(file.path);
      } catch (error) {
        // noop
      }
    }
  }
}

function enforceUploadLimit(files) {
  const total = (files || []).reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (total > MAX_UPLOAD_BYTES_TOTAL) {
    const err = new Error("Attachments total size exceeds 20MB");
    err.status = 400;
    err.code = "attachments_too_large";
    throw err;
  }
}

function zodToValidationError(error) {
  const err = new Error("Validation failed");
  err.status = 400;
  err.code = "validation_error";
  err.details = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code
  }));
  return err;
}

function ensureTicketAccess(ticket, user) {
  if (!ticket) {
    const err = new Error("Ticket not found");
    err.status = 404;
    err.code = "ticket_not_found";
    throw err;
  }

  if (user.role !== "developer" && ticket.reporter_id !== user.id) {
    const err = new Error("Forbidden");
    err.status = 403;
    err.code = "forbidden";
    throw err;
  }
}

function historyValue(value) {
  if (value == null) return null;
  return String(value);
}

function hasClosureSummaryComment(ticketId) {
  const row = db
    .prepare(
      `SELECT 1
       FROM comments
       WHERE ticket_id = ?
         AND is_closure_summary = 1
         AND is_internal = 0
       LIMIT 1`
    )
    .get(ticketId);

  return Boolean(row);
}

function normalizeRelationPair(ticketIdA, ticketIdB) {
  return ticketIdA < ticketIdB ? [ticketIdA, ticketIdB] : [ticketIdB, ticketIdA];
}

function getRelatedTickets(ticketId, user) {
  return ticketsService.getRelatedTickets({ ticketId, user });
}

function getTicket(ticketId) {
  return ticketsService.getTicketById({ ticketId });
}

function validateForeignRefs(payload) {
  if (Object.prototype.hasOwnProperty.call(payload, "project_id") && payload.project_id) {
    const project = db.prepare("SELECT 1 FROM projects WHERE id = ?").get(payload.project_id);
    if (!project) {
      const err = new Error("Project not found");
      err.status = 400;
      err.code = "project_not_found";
      throw err;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "assignee_id") && payload.assignee_id) {
    const assignee = db
      .prepare("SELECT 1 FROM users WHERE id = ?")
      .get(payload.assignee_id);
    if (!assignee) {
      const err = new Error("Assignee not found");
      err.status = 400;
      err.code = "assignee_not_found";
      throw err;
    }
  }
}

function ensureDevTaskForAcceptedTicket({ ticketId, userId, ticket }) {
  const desiredTaskStatus =
    ticket.status === "closed" || ticket.status === "waiting"
      ? "done"
      : (ticket.status === "in_progress" ? "in_progress" : "todo");

  const existing = db
    .prepare(
      `SELECT id, status
       FROM dev_tasks
       WHERE ticket_id = ? AND created_by = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(ticketId, userId);

  if (existing) {
    if (existing.status !== desiredTaskStatus) {
      db.prepare(
        "UPDATE dev_tasks SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(desiredTaskStatus, existing.id);
    }
    return;
  }

  if (desiredTaskStatus === "done") {
    return;
  }

  const maxOrder = db
    .prepare(
      "SELECT COALESCE(MAX(order_index), -1) AS max_order FROM dev_tasks WHERE created_by = ? AND status IN ('todo', 'in_progress')"
    )
    .get(userId).max_order;

  const taskTitle = String(ticket.title || `Ticket #${ticket.number || ""}`)
    .slice(0, 200)
    .trim();

  db.prepare(
    `INSERT INTO dev_tasks (
      id, title, description, priority, estimated_hours, planned_date,
      status, order_index, ticket_id, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(
    uuidv4(),
    taskTitle || `Ticket #${ticket.number || ""}`,
    ticket.description ? String(ticket.description).slice(0, 4000) : null,
    ticket.priority || "normal",
    ticket.estimated_hours ?? null,
    ticket.planned_date || null,
    desiredTaskStatus,
    Number(maxOrder) + 1,
    ticketId,
    userId
  );
}

function getNextActiveTaskOrderForUser(userId, excludeTaskId = null) {
  if (!userId) return 0;

  if (excludeTaskId) {
    const row = db
      .prepare(
        `SELECT COALESCE(MAX(order_index), -1) AS max_order
         FROM dev_tasks
         WHERE created_by = ?
           AND status IN ('todo', 'in_progress')
           AND id != ?`
      )
      .get(userId, excludeTaskId);
    return Number(row?.max_order || -1) + 1;
  }

  const row = db
    .prepare(
      `SELECT COALESCE(MAX(order_index), -1) AS max_order
       FROM dev_tasks
       WHERE created_by = ?
         AND status IN ('todo', 'in_progress')`
    )
    .get(userId);
  return Number(row?.max_order || -1) + 1;
}

function normalizeLinkedDevTasksForTicket({ ticketId, assigneeId }) {
  const activeLinkedTasks = db
    .prepare(
      `SELECT id, created_by
       FROM dev_tasks
       WHERE ticket_id = ?
         AND status IN ('todo', 'in_progress')
       ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC`
    )
    .all(ticketId);

  if (activeLinkedTasks.length === 0) {
    return;
  }

  if (!assigneeId) {
    db.prepare(
      "DELETE FROM dev_tasks WHERE ticket_id = ? AND status IN ('todo', 'in_progress')"
    ).run(ticketId);
    return;
  }

  const keepTask = activeLinkedTasks.find((task) => task.created_by === assigneeId);
  if (keepTask) {
    db.prepare(
      `DELETE FROM dev_tasks
       WHERE ticket_id = ?
         AND status IN ('todo', 'in_progress')
         AND id != ?`
    ).run(ticketId, keepTask.id);
    return;
  }

  const taskToTransfer = activeLinkedTasks[0];
  const nextOrder = getNextActiveTaskOrderForUser(assigneeId, taskToTransfer.id);

  db.prepare(
    `UPDATE dev_tasks
     SET created_by = ?, order_index = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(assigneeId, nextOrder, taskToTransfer.id);

  db.prepare(
    `DELETE FROM dev_tasks
     WHERE ticket_id = ?
       AND status IN ('todo', 'in_progress')
       AND id != ?`
  ).run(ticketId, taskToTransfer.id);
}

router.get("/", authRequired, validate({ query: listQuerySchema }), (req, res) => {
  const rows = ticketsService.listTickets({
    user: req.user,
    query: req.query
  });

  return res.json(rows);
});

router.get("/board", authRequired, requireRole("developer"), (req, res) => {
  const payload = ticketsService.getBoard();
  return res.json(payload);
});

router.get("/stats/overview", authRequired, (req, res) => {
  const payload = ticketsService.getOverviewStats();
  return res.json(payload);
});

router.get("/stats/activation", authRequired, requireRole("developer"), (req, res) => {
  const payload = ticketsService.getActivationStats();
  return res.json(payload);
});

router.get("/stats/usage", authRequired, requireRole("developer"), (req, res) => {
  const payload = ticketsService.getUsageStats();
  return res.json(payload);
});

router.get(
  "/closure-summaries/index-feed",
  authRequired,
  requireRole("developer"),
  validate({ query: closureSummaryFeedQuerySchema }),
  (req, res) => {
    const feed = ticketsService.getClosureSummaryIndexFeed({
      limit: req.query.limit ?? 200,
      updatedSince: req.query.updated_since || null
    });
    return res.json(feed);
  }
);

router.get("/workload", authRequired, (req, res) => {
  const payload = ticketsService.getWorkload({
    user: req.user
  });
  return res.json(payload);
});

router.get(
  "/:id/related",
  authRequired,
  validate({ params: idParamsSchema }),
  (req, res) => {
    const ticket = getTicket(req.params.id);
    ensureTicketAccess(ticket, req.user);
    return res.json(getRelatedTickets(req.params.id, req.user));
  }
);

router.post(
  "/:id/related",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema, body: createRelationSchema }),
  (req, res, next) => {
    try {
      const result = ticketsService.createTicketRelation({
        ticketId: req.params.id,
        user: req.user,
        payload: req.body
      });
      return res.status(result.created ? 201 : 200).json(result.items);
    } catch (error) {
      if (error?.code === "ticket_not_found") {
        return res.status(404).json({ error: "ticket_not_found" });
      }
      if (error?.code === "related_ticket_not_found") {
        return res.status(404).json({ error: "related_ticket_not_found" });
      }
      if (error?.code === "ticket_relation_self_ref") {
        return res.status(400).json({ error: "ticket_relation_self_ref" });
      }
      if (error?.code === "forbidden") {
        return res.status(403).json({ error: "forbidden" });
      }
      return next(error);
    }
  }
);

router.delete(
  "/:id/related/:relatedId",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: relatedParamsSchema }),
  (req, res) => {
    const sourceTicket = getTicket(req.params.id);
    ensureTicketAccess(sourceTicket, req.user);

    const relatedTicket = getTicket(req.params.relatedId);
    if (!relatedTicket) {
      return res.status(404).json({ error: "related_ticket_not_found" });
    }

    const [ticketIdA, ticketIdB] = normalizeRelationPair(req.params.id, req.params.relatedId);
    const result = db
      .prepare("DELETE FROM ticket_relations WHERE ticket_id_a = ? AND ticket_id_b = ?")
      .run(ticketIdA, ticketIdB);

    if (result.changes === 0) {
      return res.status(404).json({ error: "ticket_relation_not_found" });
    }

    return res.status(204).send();
  }
);

router.get(
  "/:id/external-references",
  authRequired,
  validate({ params: idParamsSchema }),
  (req, res, next) => {
    try {
      const payload = ticketsService.getTicketExternalReferences({
        ticketId: req.params.id,
        user: req.user
      });
      return res.json(payload);
    } catch (error) {
      if (error?.code === "ticket_not_found") {
        return res.status(404).json({ error: "ticket_not_found" });
      }
      if (error?.code === "forbidden") {
        return res.status(403).json({ error: "forbidden" });
      }
      return next(error);
    }
  }
);

router.post(
  "/:id/external-references",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema, body: createExternalReferenceSchema }),
  (req, res, next) => {
    try {
      const payload = ticketsService.createTicketExternalReference({
        ticketId: req.params.id,
        user: req.user,
        payload: req.body
      });
      return res.status(201).json(payload);
    } catch (error) {
      if (error?.code === "ticket_not_found") {
        return res.status(404).json({ error: "ticket_not_found" });
      }
      if (error?.code === "forbidden") {
        return res.status(403).json({ error: "forbidden" });
      }
      return next(error);
    }
  }
);

router.delete(
  "/:id/external-references/:refId",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: externalRefParamsSchema }),
  (req, res, next) => {
    try {
      ticketsService.deleteTicketExternalReference({
        ticketId: req.params.id,
        refId: req.params.refId,
        user: req.user
      });
      return res.status(204).send();
    } catch (error) {
      if (error?.code === "ticket_not_found") {
        return res.status(404).json({ error: "ticket_not_found" });
      }
      if (error?.code === "forbidden") {
        return res.status(403).json({ error: "forbidden" });
      }
      if (error?.code === "external_reference_not_found") {
        return res.status(404).json({ error: "external_reference_not_found" });
      }
      return next(error);
    }
  }
);

router.get("/:id", authRequired, validate({ params: idParamsSchema }), (req, res, next) => {
  try {
    const payload = ticketsService.getTicketDetail({
      ticketId: req.params.id,
      user: req.user
    });
    return res.json(payload);
  } catch (error) {
    if (error?.code === "ticket_not_found") {
      return res.status(404).json({ error: "ticket_not_found" });
    }
    if (error?.code === "forbidden") {
      return res.status(403).json({ error: "forbidden" });
    }
    return next(error);
  }
});

router.post(
  "/",
  authRequired,
  writeLimiter,
  upload.array("attachments", 10),
  async (req, res, next) => {
    try {
      enforceUploadLimit(req.files || []);

      let payload;
      try {
        payload = parseCreateTicketBody(req.body || {});
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw zodToValidationError(error);
        }
        throw error;
      }

      validateForeignRefs(payload);

      const createTx = db.transaction(() => {
        const counterRaw = db
          .prepare("SELECT value FROM settings WHERE key = 'ticket_counter'")
          .get()?.value;
        const nextNumber = Number.parseInt(counterRaw || "0", 10) + 1;

        db.prepare("UPDATE settings SET value = ? WHERE key = 'ticket_counter'").run(String(nextNumber));

        const id = uuidv4();
        db.prepare(
          `INSERT INTO tickets (
            id, number, title, description, steps_to_reproduce,
            expected_result, actual_result, environment,
            urgency_reporter, priority, status, category,
            project_id, reporter_id, assignee_id,
            estimated_hours, planned_date, order_index,
            internal_note, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'normal', 'submitted', ?, ?, ?, NULL, NULL, NULL, 0, NULL, datetime('now'), datetime('now'))`
        ).run(
          id,
          nextNumber,
          payload.title,
          payload.description,
          payload.steps_to_reproduce || null,
          payload.expected_result || null,
          payload.actual_result || null,
          payload.environment || null,
          payload.urgency_reporter,
          payload.category,
          payload.project_id || null,
          req.user.id
        );

        if (Array.isArray(req.files) && req.files.length) {
          const insertAttachment = db.prepare(
            `INSERT INTO attachments (
              id, ticket_id, filename, original_name,
              mime_type, size, uploaded_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          );

          for (const file of req.files) {
            insertAttachment.run(
              uuidv4(),
              id,
              file.filename,
              file.originalname,
              file.mimetype,
              file.size,
              req.user.id
            );
          }
        }

        return id;
      });

      const ticketId = createTx();
      trackTelemetryEvent({
        eventName: "ticket.created",
        userId: req.user.id,
        ticketId,
        properties: {
          status: "submitted",
          category: payload.category || "other"
        }
      });
      return res.status(201).json(getTicket(ticketId));
    } catch (error) {
      removeUploadedFiles(req.files);
      return next(error);
    }
  }
);

router.patch("/:id", authRequired, writeLimiter, validate({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const current = getTicket(req.params.id);
    ensureTicketAccess(current, req.user);

    const isDeveloper = req.user.role === "developer";
    if (!isDeveloper && current.status !== "submitted") {
      return res.status(403).json({ error: "ticket_locked" });
    }

    let payload;
    try {
      payload = (isDeveloper ? developerPatchSchema : userPatchSchema).parse(req.body || {});
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw zodToValidationError(error);
      }
      throw error;
    }

    const acceptanceStatuses = new Set(["verified", "waiting", "in_progress"]);
    const hasStatusInPayload = Object.prototype.hasOwnProperty.call(payload, "status");
    const shouldAutoVerifyFromPlanning =
      isDeveloper &&
      current.status === "submitted" &&
      (!hasStatusInPayload || payload.status === "submitted") &&
      (
        (Object.prototype.hasOwnProperty.call(payload, "assignee_id") && payload.assignee_id != null) ||
        (Object.prototype.hasOwnProperty.call(payload, "planned_date") && payload.planned_date != null) ||
        (Object.prototype.hasOwnProperty.call(payload, "estimated_hours") && payload.estimated_hours != null)
      );

    if (shouldAutoVerifyFromPlanning) {
      payload.status = "verified";
    }

    const isAcceptanceTransition =
      isDeveloper &&
      current.status === "submitted" &&
      Object.prototype.hasOwnProperty.call(payload, "status") &&
      acceptanceStatuses.has(payload.status);

    if (isAcceptanceTransition && payload.assignee_id == null) {
      payload.assignee_id = req.user.id;
    }

    validateForeignRefs(payload);

    const changedEntries = [];
    for (const [field, newValue] of Object.entries(payload)) {
      const oldValue = current[field];
      const oldComparable = oldValue == null ? null : String(oldValue);
      const newComparable = newValue == null ? null : String(newValue);
      if (oldComparable !== newComparable) {
        changedEntries.push({ field, oldValue, newValue });
      }
    }

    if (changedEntries.length === 0) {
      return res.status(400).json({ error: "no_changes" });
    }

    const oldStatus = current.status;
    const newStatus = Object.prototype.hasOwnProperty.call(payload, "status")
      ? payload.status
      : oldStatus;

    const isClosingTransition = isDeveloper && oldStatus !== "closed" && newStatus === "closed";
    if (isClosingTransition && !hasClosureSummaryComment(req.params.id)) {
      return res.status(400).json({ error: "closure_summary_required" });
    }

    const nextAssigneeId = Object.prototype.hasOwnProperty.call(payload, "assignee_id")
      ? payload.assignee_id
      : current.assignee_id;
    const hasStatusChange = newStatus !== oldStatus;
    const hasAssigneeChange = nextAssigneeId !== current.assignee_id;
    const isAssignmentToCurrentDeveloper =
      isDeveloper &&
      nextAssigneeId === req.user.id &&
      current.assignee_id !== req.user.id &&
      acceptanceStatuses.has(newStatus);
    const shouldEnsureDevTask =
      isDeveloper &&
      Boolean(nextAssigneeId) &&
      (
      isAcceptanceTransition ||
      isAssignmentToCurrentDeveloper ||
      hasStatusChange ||
      hasAssigneeChange
      );
    const shouldNormalizeLinkedTasks =
      isDeveloper &&
      (
        hasStatusChange ||
        hasAssigneeChange
      );
    const nextTicketState = { ...current, ...payload };

    const updateTx = db.transaction(() => {
      const setters = [];
      const values = [];

      for (const item of changedEntries) {
        setters.push(`${item.field} = ?`);
        values.push(item.newValue ?? null);
      }

      if (newStatus !== oldStatus) {
        if (newStatus === "closed") {
          setters.push("closed_at = datetime('now')");
        } else if (oldStatus === "closed") {
          setters.push("closed_at = NULL");
        }
      }

      setters.push("updated_at = datetime('now')");
      values.push(req.params.id);

      db.prepare(`UPDATE tickets SET ${setters.join(", ")} WHERE id = ?`).run(...values);

      const insertHistory = db.prepare(
        `INSERT INTO ticket_history (
          id, ticket_id, user_id, field, old_value, new_value, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      );

      for (const item of changedEntries) {
        insertHistory.run(
          uuidv4(),
          req.params.id,
          req.user.id,
          item.field,
          historyValue(item.oldValue),
          historyValue(item.newValue)
        );
      }

      if (shouldNormalizeLinkedTasks) {
        normalizeLinkedDevTasksForTicket({
          ticketId: req.params.id,
          assigneeId: nextAssigneeId
        });
      }

      if (shouldEnsureDevTask) {
        ensureDevTaskForAcceptedTicket({
          ticketId: req.params.id,
          userId: nextAssigneeId,
          ticket: nextTicketState
        });
      }
    });

    updateTx();

    if (newStatus !== oldStatus && newStatus === "closed") {
      trackTelemetryEvent({
        eventName: "ticket.closed",
        userId: req.user.id,
        ticketId: req.params.id,
        properties: {
          old_status: oldStatus,
          new_status: newStatus
        }
      });
    }

    if (newStatus !== oldStatus && oldStatus !== "submitted") {
      trackTelemetryEvent({
        eventName: "board.drag",
        userId: req.user.id,
        ticketId: req.params.id,
        properties: {
          old_status: oldStatus,
          new_status: newStatus
        }
      });
    }

    if (newStatus !== oldStatus) {
      try {
        await notifyReporterStatusChange({
          ticketId: req.params.id,
          actorUserId: req.user.id,
          oldStatus,
          newStatus
        });
      } catch (error) {
        console.error("status_notification_failed", error);
      }
    }

    return res.json(getTicket(req.params.id));
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/:id/comments",
  authRequired,
  writeLimiter,
  validate({ params: idParamsSchema, body: createCommentSchema }),
  async (req, res, next) => {
    try {
      const ticket = getTicket(req.params.id);
      ensureTicketAccess(ticket, req.user);

      if (req.body.is_internal && req.user.role !== "developer") {
        return res.status(403).json({ error: "forbidden" });
      }

      if (req.body.is_closure_summary && req.user.role !== "developer") {
        return res.status(403).json({ error: "forbidden" });
      }

      if (req.body.is_closure_summary && req.body.is_internal) {
        return res.status(400).json({ error: "invalid_closure_summary_visibility" });
      }

      if (req.body.parent_id) {
        const parent = db
          .prepare("SELECT id FROM comments WHERE id = ? AND ticket_id = ?")
          .get(req.body.parent_id, req.params.id);
        if (!parent) {
          return res.status(400).json({ error: "invalid_parent_comment" });
        }
      }

      const commentId = uuidv4();
      db.prepare(
        `INSERT INTO comments (
          id, ticket_id, user_id, content,
          is_developer, is_internal, is_closure_summary, type,
          parent_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        commentId,
        req.params.id,
        req.user.id,
        req.body.content,
        req.user.role === "developer" ? 1 : 0,
        req.body.is_internal ? 1 : 0,
        req.body.is_closure_summary ? 1 : 0,
        req.body.type || "comment",
        req.body.parent_id || null
      );

      const comment = db
        .prepare("SELECT * FROM comments WHERE id = ?")
        .get(commentId);

      if (req.user.role === "developer" && !req.body.is_internal) {
        try {
          await notifyReporterDeveloperComment({
            ticketId: req.params.id,
            actorUserId: req.user.id,
            commentContent: req.body.content
          });
        } catch (error) {
          console.error("comment_notification_failed", error);
        }
      }

      if (req.user.role === "developer" && req.body.is_closure_summary) {
        trackTelemetryEvent({
          eventName: "closure_summary_added",
          userId: req.user.id,
          ticketId: req.params.id,
          properties: {
            comment_id: commentId
          }
        });
      }

      return res.status(201).json(comment);
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/:id/attachments",
  authRequired,
  writeLimiter,
  validate({ params: idParamsSchema }),
  upload.array("attachments", 10),
  (req, res, next) => {
    try {
      const ticket = getTicket(req.params.id);
      ensureTicketAccess(ticket, req.user);

      if (!Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: "attachments_required" });
      }

      enforceUploadLimit(req.files);

      const insertAttachment = db.prepare(
        `INSERT INTO attachments (
          id, ticket_id, filename, original_name,
          mime_type, size, uploaded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      );

      const created = [];
      const tx = db.transaction(() => {
        for (const file of req.files) {
          const id = uuidv4();
          insertAttachment.run(
            id,
            req.params.id,
            file.filename,
            file.originalname,
            file.mimetype,
            file.size,
            req.user.id
          );
          created.push(
            db.prepare("SELECT * FROM attachments WHERE id = ?").get(id)
          );
        }
      });

      tx();
      return res.status(201).json(created);
    } catch (error) {
      removeUploadedFiles(req.files);
      return next(error);
    }
  }
);

module.exports = router;
