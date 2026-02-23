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
const { TELEMETRY_EVENT_NAMES, trackTelemetryEvent } = require("../services/telemetry");

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
  const params = [ticketId, ticketId, ticketId];
  let reporterFilterSql = "";

  if (user.role !== "developer") {
    reporterFilterSql = "AND t.reporter_id = ?";
    params.push(user.id);
  }

  return db
    .prepare(
      `SELECT
        t.id,
        t.number,
        t.title,
        t.status,
        t.priority,
        t.category,
        t.assignee_id,
        t.reporter_id,
        t.updated_at
      FROM ticket_relations tr
      JOIN tickets t ON t.id = CASE
        WHEN tr.ticket_id_a = ? THEN tr.ticket_id_b
        ELSE tr.ticket_id_a
      END
      WHERE (tr.ticket_id_a = ? OR tr.ticket_id_b = ?)
        ${reporterFilterSql}
      ORDER BY datetime(t.updated_at) DESC`
    )
    .all(...params);
}

function resolveRelatedTicket({ relatedTicketId, relatedTicketNumber }) {
  if (relatedTicketId) {
    return db.prepare("SELECT id, number FROM tickets WHERE id = ?").get(relatedTicketId);
  }

  return db
    .prepare("SELECT id, number FROM tickets WHERE number = ?")
    .get(Number(relatedTicketNumber));
}

function getExternalReferences(ticketId) {
  return db
    .prepare(
      `SELECT
        r.id,
        r.ref_type,
        r.url,
        r.title,
        r.created_by,
        r.created_at,
        u.name AS created_by_name,
        u.email AS created_by_email
      FROM ticket_external_references r
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.ticket_id = ?
      ORDER BY datetime(r.created_at) DESC`
    )
    .all(ticketId);
}

function buildClosureSummaryIndexFeed({ limit = 200, updatedSince = null }) {
  const params = [];
  let where = "";

  if (updatedSince) {
    where = "WHERE datetime(ls.summary_created_at) >= datetime(?)";
    params.push(updatedSince);
  }

  params.push(limit);

  const rows = db
    .prepare(
      `WITH latest_summaries AS (
        SELECT c.ticket_id, c.id AS summary_id, c.content AS summary_content, c.created_at AS summary_created_at, c.user_id AS summary_user_id
        FROM comments c
        JOIN (
          SELECT ticket_id, MAX(rowid) AS max_rowid
          FROM comments
          WHERE is_closure_summary = 1
            AND is_internal = 0
          GROUP BY ticket_id
        ) m ON m.max_rowid = c.rowid
      )
      SELECT
        ls.summary_id,
        ls.summary_content,
        ls.summary_created_at,
        t.id AS ticket_id,
        t.number AS ticket_number,
        t.title AS ticket_title,
        t.status AS ticket_status,
        t.priority AS ticket_priority,
        t.category AS ticket_category,
        t.updated_at AS ticket_updated_at,
        u.name AS summary_author_name,
        u.email AS summary_author_email
      FROM latest_summaries ls
      JOIN tickets t ON t.id = ls.ticket_id
      LEFT JOIN users u ON u.id = ls.summary_user_id
      ${where}
      ORDER BY datetime(ls.summary_created_at) DESC
      LIMIT ?`
    )
    .all(...params);

  return {
    generated_at: new Date().toISOString(),
    count: rows.length,
    items: rows.map((row) => ({
      index_key: `ticket:${row.ticket_id}:summary:${row.summary_id}`,
      summary_comment_id: row.summary_id,
      summary_content: row.summary_content,
      summary_created_at: row.summary_created_at,
      summary_author_name: row.summary_author_name || null,
      summary_author_email: row.summary_author_email || null,
      ticket_id: row.ticket_id,
      ticket_number: row.ticket_number,
      ticket_title: row.ticket_title,
      ticket_status: row.ticket_status,
      ticket_priority: row.ticket_priority,
      ticket_category: row.ticket_category,
      ticket_updated_at: row.ticket_updated_at
    }))
  };
}

function parseSqliteDateToEpochMs(value) {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const withZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized)
    ? normalized
    : `${normalized}Z`;

  const epochMs = Date.parse(withZone);
  return Number.isFinite(epochMs) ? epochMs : null;
}

function minutesBetween(startValue, endValue) {
  const startEpoch = parseSqliteDateToEpochMs(startValue);
  const endEpoch = parseSqliteDateToEpochMs(endValue);

  if (startEpoch == null || endEpoch == null || endEpoch < startEpoch) {
    return null;
  }

  return (endEpoch - startEpoch) / 60000;
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function summarizeMinuteSamples(samples) {
  if (!samples.length) {
    return {
      avg_minutes: null,
      median_minutes: null,
      sample_size: 0
    };
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];

  return {
    avg_minutes: roundToTwo(average),
    median_minutes: roundToTwo(median),
    sample_size: samples.length
  };
}

function buildActivationStats() {
  const users = db
    .prepare(
      `SELECT id, created_at
       FROM users
       WHERE role = 'user'`
    )
    .all();

  const tickets = db
    .prepare(
      `SELECT id, reporter_id, created_at
       FROM tickets
       ORDER BY datetime(created_at) ASC, id ASC`
    )
    .all();

  const assignmentHistory = db
    .prepare(
      `SELECT ticket_id, created_at, new_value
       FROM ticket_history
       WHERE field = 'assignee_id'
       ORDER BY datetime(created_at) ASC, id ASC`
    )
    .all();

  const firstTicketByReporter = new Map();
  for (const ticket of tickets) {
    if (!firstTicketByReporter.has(ticket.reporter_id)) {
      firstTicketByReporter.set(ticket.reporter_id, ticket);
    }
  }

  const firstAssignmentByTicket = new Map();
  for (const entry of assignmentHistory) {
    const assigneeValue = entry.new_value == null ? "" : String(entry.new_value).trim();
    if (!assigneeValue) {
      continue;
    }

    if (!firstAssignmentByTicket.has(entry.ticket_id)) {
      firstAssignmentByTicket.set(entry.ticket_id, entry.created_at);
    }
  }

  const firstTicketSamples = [];
  const firstAssignmentSamples = [];
  let firstAssignmentUnderThirtyCount = 0;

  for (const user of users) {
    const firstTicket = firstTicketByReporter.get(user.id);
    if (!firstTicket) {
      continue;
    }

    const timeToFirstTicketMinutes = minutesBetween(user.created_at, firstTicket.created_at);
    if (timeToFirstTicketMinutes != null) {
      firstTicketSamples.push(timeToFirstTicketMinutes);
    }

    const firstAssignmentAt = firstAssignmentByTicket.get(firstTicket.id);
    if (!firstAssignmentAt) {
      continue;
    }

    const timeToFirstAssignmentMinutes = minutesBetween(firstTicket.created_at, firstAssignmentAt);
    if (timeToFirstAssignmentMinutes == null) {
      continue;
    }

    firstAssignmentSamples.push(timeToFirstAssignmentMinutes);
    if (timeToFirstAssignmentMinutes <= 30) {
      firstAssignmentUnderThirtyCount += 1;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    users_total: users.length,
    users_with_first_ticket: firstTicketSamples.length,
    users_with_first_dev_assignment: firstAssignmentSamples.length,
    time_to_first_ticket_minutes: summarizeMinuteSamples(firstTicketSamples),
    time_to_first_dev_assignment_minutes: summarizeMinuteSamples(firstAssignmentSamples),
    first_dev_assignment_under_30m: {
      within_target_count: firstAssignmentUnderThirtyCount,
      within_target_percent: firstAssignmentSamples.length
        ? roundToTwo((firstAssignmentUnderThirtyCount / firstAssignmentSamples.length) * 100)
        : null,
      sample_size: firstAssignmentSamples.length
    }
  };
}

const TELEMETRY_USAGE_EVENT_CONFIG = [
  { eventName: "ticket.created", key: "ticket_created" },
  { eventName: "ticket.closed", key: "ticket_closed" },
  { eventName: "board.drag", key: "board_drag" },
  { eventName: "devtodo.reorder", key: "devtodo_reorder" },
  { eventName: "closure_summary_added", key: "closure_summary_added" }
];

function formatDateUtc(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildLastDaysLabels(days) {
  const labels = [];
  const now = new Date();
  const baseUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayDate = new Date(baseUtc - offset * 24 * 60 * 60 * 1000);
    labels.push(formatDateUtc(dayDate));
  }

  return labels;
}

function buildFeatureUsageStats() {
  const perEventDefaults = Object.fromEntries(
    TELEMETRY_USAGE_EVENT_CONFIG.map((entry) => [
      entry.key,
      {
        event_name: entry.eventName,
        count_30d: 0,
        unique_users_30d: 0,
        last_event_at: null
      }
    ])
  );

  const eventNamesList = TELEMETRY_USAGE_EVENT_CONFIG.map((entry) => `'${entry.eventName}'`).join(", ");
  const countsByEvent = db
    .prepare(
      `SELECT
        event_name,
        COUNT(*) AS count,
        COUNT(DISTINCT user_id) AS unique_users,
        MAX(created_at) AS last_event_at
       FROM telemetry_events
       WHERE event_name IN (${eventNamesList})
         AND datetime(created_at) >= datetime('now', '-30 days')
       GROUP BY event_name`
    )
    .all();

  const eventKeyByName = new Map(
    TELEMETRY_USAGE_EVENT_CONFIG.map((entry) => [entry.eventName, entry.key])
  );

  for (const row of countsByEvent) {
    const key = eventKeyByName.get(row.event_name);
    if (!key) continue;
    perEventDefaults[key] = {
      event_name: row.event_name,
      count_30d: Number(row.count) || 0,
      unique_users_30d: Number(row.unique_users) || 0,
      last_event_at: row.last_event_at || null
    };
  }

  const totalsRaw = db
    .prepare(
      `SELECT
        COUNT(*) AS events_count,
        COUNT(DISTINCT user_id) AS unique_users_count,
        COUNT(DISTINCT date(created_at)) AS active_days_count
       FROM telemetry_events
       WHERE event_name IN (${eventNamesList})
         AND datetime(created_at) >= datetime('now', '-30 days')`
    )
    .get();

  const timelineDays = 14;
  const labels = buildLastDaysLabels(timelineDays);
  const timeline = labels.map((dateLabel) => {
    const row = { date: dateLabel, total: 0 };
    for (const entry of TELEMETRY_USAGE_EVENT_CONFIG) {
      row[entry.key] = 0;
    }
    return row;
  });

  const timelineByDay = new Map(timeline.map((item) => [item.date, item]));
  const dailyRows = db
    .prepare(
      `SELECT
        date(created_at) AS day,
        event_name,
        COUNT(*) AS count
       FROM telemetry_events
       WHERE event_name IN (${eventNamesList})
         AND datetime(created_at) >= datetime('now', '-14 days')
       GROUP BY day, event_name
       ORDER BY day ASC`
    )
    .all();

  for (const row of dailyRows) {
    const target = timelineByDay.get(row.day);
    const key = eventKeyByName.get(row.event_name);
    if (!target || !key) continue;
    const count = Number(row.count) || 0;
    target[key] += count;
    target.total += count;
  }

  return {
    generated_at: new Date().toISOString(),
    window_days: 30,
    events: perEventDefaults,
    totals: {
      events_30d: Number(totalsRaw?.events_count) || 0,
      unique_users_30d: Number(totalsRaw?.unique_users_count) || 0,
      active_days_30d: Number(totalsRaw?.active_days_count) || 0
    },
    daily_breakdown_14d: timeline
  };
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
        t.id, t.number, t.title, t.description, t.status, t.priority, t.category, t.project_id,
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

router.get("/stats/activation", authRequired, requireRole("developer"), (req, res) => {
  return res.json(buildActivationStats());
});

router.get("/stats/usage", authRequired, requireRole("developer"), (req, res) => {
  const unknownEventsCount = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM telemetry_events
       WHERE datetime(created_at) >= datetime('now', '-30 days')`
    )
    .get().count;
  const knownEventsCount = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM telemetry_events
       WHERE event_name IN (${Array.from(TELEMETRY_EVENT_NAMES).map((name) => `'${name}'`).join(", ")})
         AND datetime(created_at) >= datetime('now', '-30 days')`
    )
    .get().count;

  const payload = buildFeatureUsageStats();
  payload.known_events_coverage_30d = {
    known_events_count: Number(knownEventsCount) || 0,
    all_events_count: Number(unknownEventsCount) || 0,
    coverage_percent:
      Number(unknownEventsCount) > 0
        ? roundToTwo((Number(knownEventsCount) / Number(unknownEventsCount)) * 100)
        : 100
  };
  return res.json(payload);
});

router.get(
  "/closure-summaries/index-feed",
  authRequired,
  requireRole("developer"),
  validate({ query: closureSummaryFeedQuerySchema }),
  (req, res) => {
    const feed = buildClosureSummaryIndexFeed({
      limit: req.query.limit ?? 200,
      updatedSince: req.query.updated_since || null
    });
    return res.json(feed);
  }
);

router.get("/workload", authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT
        t.id,
        t.number,
        t.title,
        t.status,
        t.priority,
        t.category,
        t.reporter_id,
        t.assignee_id,
        t.planned_date,
        t.created_at,
        t.updated_at,
        ru.name AS reporter_name,
        ru.email AS reporter_email,
        au.name AS assignee_name,
        au.email AS assignee_email
      FROM tickets t
      LEFT JOIN users ru ON ru.id = t.reporter_id
      LEFT JOIN users au ON au.id = t.assignee_id
      WHERE t.status IN ('submitted', 'verified', 'in_progress', 'waiting', 'blocked')
      ORDER BY
        CASE t.status
          WHEN 'in_progress' THEN 1
          WHEN 'verified' THEN 2
          WHEN 'waiting' THEN 3
          WHEN 'blocked' THEN 4
          WHEN 'submitted' THEN 5
          ELSE 9
        END ASC,
        CASE WHEN t.planned_date IS NULL THEN 1 ELSE 0 END ASC,
        t.planned_date ASC,
        t.updated_at DESC`
    )
    .all();

  const payload = {
    in_progress: [],
    queue: [],
    blocked: [],
    submitted: [],
    _stats: {
      in_progress: 0,
      queue: 0,
      blocked: 0,
      submitted: 0,
      open: 0
    }
  };

  const canOpenAll = req.user.role === "developer";

  for (const row of rows) {
    const ticket = {
      ...row,
      can_open: canOpenAll || row.reporter_id === req.user.id
    };

    if (row.status === "in_progress") {
      payload.in_progress.push(ticket);
      payload._stats.in_progress += 1;
      payload._stats.open += 1;
      continue;
    }

    if (row.status === "verified" || row.status === "waiting") {
      payload.queue.push(ticket);
      payload._stats.queue += 1;
      payload._stats.open += 1;
      continue;
    }

    if (row.status === "blocked") {
      payload.blocked.push(ticket);
      payload._stats.blocked += 1;
      payload._stats.open += 1;
      continue;
    }

    if (row.status === "submitted") {
      payload.submitted.push(ticket);
      payload._stats.submitted += 1;
      payload._stats.open += 1;
    }
  }

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
  (req, res) => {
    const sourceTicket = getTicket(req.params.id);
    ensureTicketAccess(sourceTicket, req.user);

    const relatedTicket = resolveRelatedTicket({
      relatedTicketId: req.body.related_ticket_id,
      relatedTicketNumber: req.body.related_ticket_number
    });

    if (!relatedTicket) {
      return res.status(404).json({ error: "related_ticket_not_found" });
    }

    if (relatedTicket.id === req.params.id) {
      return res.status(400).json({ error: "ticket_relation_self_ref" });
    }

    const [ticketIdA, ticketIdB] = normalizeRelationPair(req.params.id, relatedTicket.id);
    const existing = db
      .prepare(
        "SELECT id FROM ticket_relations WHERE ticket_id_a = ? AND ticket_id_b = ? LIMIT 1"
      )
      .get(ticketIdA, ticketIdB);

    if (!existing) {
      db.prepare(
        `INSERT INTO ticket_relations (
          id, ticket_id_a, ticket_id_b, relation_type, created_by, created_at
        ) VALUES (?, ?, ?, 'related', ?, datetime('now'))`
      ).run(uuidv4(), ticketIdA, ticketIdB, req.user.id);
    }

    return res.status(existing ? 200 : 201).json(getRelatedTickets(req.params.id, req.user));
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
  (req, res) => {
    const ticket = getTicket(req.params.id);
    ensureTicketAccess(ticket, req.user);
    return res.json(getExternalReferences(req.params.id));
  }
);

router.post(
  "/:id/external-references",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema, body: createExternalReferenceSchema }),
  (req, res) => {
    const ticket = getTicket(req.params.id);
    ensureTicketAccess(ticket, req.user);

    const id = uuidv4();
    const title = req.body.title ? String(req.body.title).trim() : null;

    db.prepare(
      `INSERT INTO ticket_external_references (
        id, ticket_id, ref_type, url, title, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      id,
      req.params.id,
      req.body.ref_type,
      String(req.body.url).trim(),
      title || null,
      req.user.id
    );

    return res.status(201).json(getExternalReferences(req.params.id));
  }
);

router.delete(
  "/:id/external-references/:refId",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: externalRefParamsSchema }),
  (req, res) => {
    const ticket = getTicket(req.params.id);
    ensureTicketAccess(ticket, req.user);

    const result = db
      .prepare("DELETE FROM ticket_external_references WHERE id = ? AND ticket_id = ?")
      .run(req.params.refId, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "external_reference_not_found" });
    }

    return res.status(204).send();
  }
);

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

  const relatedTickets = getRelatedTickets(ticket.id, req.user);
  const externalReferences = getExternalReferences(ticket.id);

  return res.json({
    ...ticket,
    comments,
    attachments,
    history,
    related_tickets: relatedTickets,
    external_references: externalReferences
  });
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
