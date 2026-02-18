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
    type: z.enum(COMMENT_TYPES).optional().default("comment"),
    parent_id: z.string().uuid().nullable().optional()
  })
  .strict();

function normalizeText(input) {
  if (typeof input !== "string") return undefined;
  const value = input.trim();
  return value.length ? value : undefined;
}

function normalizeNullableText(input) {
  if (input == null) return null;
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value.length ? value : null;
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

function getTicket(ticketId) {
  return db.prepare("SELECT * FROM tickets WHERE id = ?").get(ticketId);
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

router.get("/", authRequired, validate({ query: listQuerySchema }), (req, res) => {
  const filters = [];
  const params = [];

  if (req.user.role !== "developer" || req.query.my === "1") {
    filters.push("t.reporter_id = ?");
    params.push(req.user.id);
  }

  if (req.query.status) {
    filters.push("t.status = ?");
    params.push(req.query.status);
  }

  if (req.query.priority) {
    filters.push("t.priority = ?");
    params.push(req.query.priority);
  }

  if (req.query.category) {
    filters.push("t.category = ?");
    params.push(req.query.category);
  }

  if (req.query.project_id) {
    filters.push("t.project_id = ?");
    params.push(req.query.project_id);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT
        t.id,
        t.number,
        t.title,
        t.category,
        t.priority,
        t.status,
        t.project_id,
        t.reporter_id,
        t.assignee_id,
        t.planned_date,
        t.created_at,
        t.updated_at,
        p.name AS project_name,
        p.color AS project_color
      FROM tickets t
      LEFT JOIN projects p ON p.id = t.project_id
      ${where}
      ORDER BY t.updated_at DESC
      LIMIT 500`
    )
    .all(...params);

  return res.json(rows);
});

router.get("/board", authRequired, requireRole("developer"), (req, res) => {
  const payload = Object.fromEntries(TICKET_STATUSES.map((status) => [status, []]));
  const rows = db
    .prepare(
      `SELECT
        t.id, t.number, t.title, t.status, t.priority, t.project_id,
        t.reporter_id, t.assignee_id, t.planned_date,
        p.name AS project_name, p.color AS project_color,
        ru.name AS reporter_name, au.name AS assignee_name
      FROM tickets t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN users ru ON ru.id = t.reporter_id
      LEFT JOIN users au ON au.id = t.assignee_id
      ORDER BY t.updated_at DESC`
    )
    .all();

  for (const row of rows) {
    if (payload[row.status]) {
      payload[row.status].push(row);
    }
  }

  payload._stats = TICKET_STATUSES.reduce((acc, key) => {
    acc[key] = payload[key].length;
    return acc;
  }, {});

  return res.json(payload);
});

router.get("/stats/overview", authRequired, (req, res) => {
  const counts = db
    .prepare("SELECT status, COUNT(*) AS count FROM tickets GROUP BY status")
    .all()
    .reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});

  const closedToday = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tickets
       WHERE status = 'closed'
         AND closed_at IS NOT NULL
         AND date(closed_at) = date('now')`
    )
    .get().count;

  return res.json({
    in_progress: counts.in_progress || 0,
    waiting: counts.waiting || 0,
    submitted: counts.submitted || 0,
    verified: counts.verified || 0,
    blocked: counts.blocked || 0,
    closed_today: closedToday || 0
  });
});

router.get("/:id", authRequired, validate({ params: idParamsSchema }), (req, res) => {
  const ticket = getTicket(req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: "ticket_not_found" });
  }

  if (req.user.role !== "developer" && ticket.reporter_id !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }

  const commentsQuery =
    req.user.role === "developer"
      ? `SELECT c.*, u.name AS user_name, u.email AS user_email
         FROM comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.ticket_id = ?
         ORDER BY c.created_at ASC`
      : `SELECT c.*, u.name AS user_name, u.email AS user_email
         FROM comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.ticket_id = ? AND c.is_internal = 0
         ORDER BY c.created_at ASC`;

  const comments = db.prepare(commentsQuery).all(ticket.id);
  const attachments = db
    .prepare("SELECT * FROM attachments WHERE ticket_id = ? ORDER BY created_at ASC")
    .all(ticket.id);
  const history = db
    .prepare(
      `SELECT h.*, u.name AS user_name, u.email AS user_email
       FROM ticket_history h
       LEFT JOIN users u ON u.id = h.user_id
       WHERE h.ticket_id = ?
       ORDER BY h.created_at DESC`
    )
    .all(ticket.id);

  return res.json({ ...ticket, comments, attachments, history });
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
    });

    updateTx();

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
          is_developer, is_internal, type,
          parent_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        commentId,
        req.params.id,
        req.user.id,
        req.body.content,
        req.user.role === "developer" ? 1 : 0,
        req.body.is_internal ? 1 : 0,
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
