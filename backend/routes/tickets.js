const fs = require("fs");
const express = require("express");
const { z } = require("zod");
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

function getTicket(ticketId) {
  return ticketsService.getTicketById({ ticketId });
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
  (req, res, next) => {
    try {
      const payload = ticketsService.getTicketRelatedList({
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
  (req, res, next) => {
    try {
      ticketsService.deleteTicketRelation({
        ticketId: req.params.id,
        relatedTicketId: req.params.relatedId,
        user: req.user
      });
      return res.status(204).send();
    } catch (error) {
      if (error?.code === "ticket_not_found") {
        return res.status(404).json({ error: "ticket_not_found" });
      }
      if (error?.code === "related_ticket_not_found") {
        return res.status(404).json({ error: "related_ticket_not_found" });
      }
      if (error?.code === "ticket_relation_not_found") {
        return res.status(404).json({ error: "ticket_relation_not_found" });
      }
      if (error?.code === "forbidden") {
        return res.status(403).json({ error: "forbidden" });
      }
      return next(error);
    }
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

      const result = ticketsService.createTicket({
        user: req.user,
        payload,
        files: req.files
      });

      if (result.shouldTrackTicketCreated) {
        trackTelemetryEvent({
          eventName: "ticket.created",
          userId: req.user.id,
          ticketId: result.ticketId,
          properties: result.telemetry
        });
      }
      return res.status(201).json(getTicket(result.ticketId));
    } catch (error) {
      removeUploadedFiles(req.files);
      if (error?.code === "project_not_found") {
        return res.status(400).json({ error: "project_not_found" });
      }
      return next(error);
    }
  }
);

router.patch("/:id", authRequired, writeLimiter, validate({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const result = ticketsService.updateTicket({
      ticketId: req.params.id,
      user: req.user,
      rawPayload: req.body
    });

    if (result.shouldTrackTicketClosed) {
      trackTelemetryEvent({
        eventName: "ticket.closed",
        userId: req.user.id,
        ticketId: req.params.id,
        properties: {
          old_status: result.oldStatus,
          new_status: result.newStatus
        }
      });
    }

    if (result.shouldTrackBoardDrag) {
      trackTelemetryEvent({
        eventName: "board.drag",
        userId: req.user.id,
        ticketId: req.params.id,
        properties: {
          old_status: result.oldStatus,
          new_status: result.newStatus
        }
      });
    }

    if (result.shouldNotifyStatusChange) {
      try {
        await notifyReporterStatusChange({
          ticketId: req.params.id,
          actorUserId: req.user.id,
          oldStatus: result.oldStatus,
          newStatus: result.newStatus
        });
      } catch (error) {
        console.error("status_notification_failed", error);
      }
    }

    return res.json(result.ticket);
  } catch (error) {
    if (error?.code === "validation_error") {
      return res.status(400).json({ error: "validation_error", details: error.details || [] });
    }
    if (error?.code === "ticket_not_found") {
      return res.status(404).json({ error: "ticket_not_found" });
    }
    if (error?.code === "forbidden") {
      return res.status(403).json({ error: "forbidden" });
    }
    if (error?.code === "ticket_locked") {
      return res.status(403).json({ error: "ticket_locked" });
    }
    if (error?.code === "project_not_found") {
      return res.status(400).json({ error: "project_not_found" });
    }
    if (error?.code === "assignee_not_found") {
      return res.status(400).json({ error: "assignee_not_found" });
    }
    if (error?.code === "closure_summary_required") {
      return res.status(400).json({ error: "closure_summary_required" });
    }
    if (error?.code === "no_changes") {
      return res.status(400).json({ error: "no_changes" });
    }
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
      const result = ticketsService.createTicketComment({
        ticketId: req.params.id,
        user: req.user,
        payload: req.body
      });

      if (result.shouldNotifyReporterDeveloperComment) {
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

      if (result.shouldTrackClosureSummary) {
        trackTelemetryEvent({
          eventName: "closure_summary_added",
          userId: req.user.id,
          ticketId: req.params.id,
          properties: {
            comment_id: result.comment.id
          }
        });
      }

      return res.status(201).json(result.comment);
    } catch (error) {
      if (error?.code === "ticket_not_found") {
        return res.status(404).json({ error: "ticket_not_found" });
      }
      if (error?.code === "forbidden") {
        return res.status(403).json({ error: "forbidden" });
      }
      if (error?.code === "invalid_closure_summary_visibility") {
        return res.status(400).json({ error: "invalid_closure_summary_visibility" });
      }
      if (error?.code === "invalid_parent_comment") {
        return res.status(400).json({ error: "invalid_parent_comment" });
      }
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
      const payload = ticketsService.createTicketAttachments({
        ticketId: req.params.id,
        user: req.user,
        files: req.files,
        maxUploadBytesTotal: MAX_UPLOAD_BYTES_TOTAL
      });
      return res.status(201).json(payload);
    } catch (error) {
      removeUploadedFiles(req.files);
      if (error?.code === "ticket_not_found") {
        return res.status(404).json({ error: "ticket_not_found" });
      }
      if (error?.code === "forbidden") {
        return res.status(403).json({ error: "forbidden" });
      }
      if (error?.code === "attachments_required") {
        return res.status(400).json({ error: "attachments_required" });
      }
      if (error?.code === "attachments_too_large") {
        return res.status(400).json({ error: "attachments_too_large" });
      }
      return next(error);
    }
  }
);

module.exports = router;
