const db = require("../db");
const { v4: uuidv4 } = require("uuid");
const { TELEMETRY_EVENT_NAMES } = require("./telemetry");
const { TICKET_STATUSES } = require("../constants");

function assertUserContext(user) {
  if (!user || !user.id || !user.role) {
    throw new Error("invalid_user_context");
  }
}

function createServiceError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function getReadableTicketOrThrow({ database, ticketId, user }) {
  assertUserContext(user);

  const ticket = database
    .prepare("SELECT * FROM tickets WHERE id = ?")
    .get(ticketId);

  if (!ticket) {
    throw createServiceError("ticket_not_found", 404);
  }

  if (user.role !== "developer" && ticket.reporter_id !== user.id) {
    throw createServiceError("forbidden", 403);
  }

  return ticket;
}

function normalizeRelationPair(ticketIdA, ticketIdB) {
  return ticketIdA < ticketIdB ? [ticketIdA, ticketIdB] : [ticketIdB, ticketIdA];
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

function buildFeatureUsageStats(database) {
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
  const countsByEvent = database
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

  const totalsRaw = database
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
  const dailyRows = database
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

function buildClosureSummaryIndexFeed(database, { limit = 200, updatedSince = null }) {
  const params = [];
  let where = "";

  if (updatedSince) {
    where = "WHERE datetime(ls.summary_created_at) >= datetime(?)";
    params.push(updatedSince);
  }

  params.push(limit);

  const rows = database
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

function buildBoardPayload(database) {
  const payload = Object.fromEntries(TICKET_STATUSES.map((status) => [status, []]));
  const rows = database
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

  return payload;
}

function createTicketsService(options = {}) {
  const database = options.db || db;

  return {
    getTicketById({ ticketId }) {
      return database
        .prepare("SELECT * FROM tickets WHERE id = ?")
        .get(ticketId);
    },

    getRelatedTickets({ ticketId, user }) {
      assertUserContext(user);

      const params = [ticketId, ticketId, ticketId];
      let reporterFilterSql = "";

      if (user.role !== "developer") {
        reporterFilterSql = "AND t.reporter_id = ?";
        params.push(user.id);
      }

      return database
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
    },

    getTicketRelatedList({ ticketId, user }) {
      getReadableTicketOrThrow({ database, ticketId, user });
      return this.getRelatedTickets({ ticketId, user });
    },

    createTicketRelation({ ticketId, user, payload }) {
      assertUserContext(user);

      if (user.role !== "developer") {
        throw createServiceError("forbidden", 403);
      }

      const sourceTicket = this.getTicketById({ ticketId });
      if (!sourceTicket) {
        throw createServiceError("ticket_not_found", 404);
      }

      let relatedTicket = null;
      if (payload?.related_ticket_id) {
        relatedTicket = database
          .prepare("SELECT id, number FROM tickets WHERE id = ?")
          .get(payload.related_ticket_id);
      } else if (payload?.related_ticket_number != null) {
        relatedTicket = database
          .prepare("SELECT id, number FROM tickets WHERE number = ?")
          .get(Number(payload.related_ticket_number));
      }

      if (!relatedTicket) {
        throw createServiceError("related_ticket_not_found", 404);
      }

      if (relatedTicket.id === ticketId) {
        throw createServiceError("ticket_relation_self_ref", 400);
      }

      const [ticketIdA, ticketIdB] = normalizeRelationPair(ticketId, relatedTicket.id);
      const existing = database
        .prepare("SELECT id FROM ticket_relations WHERE ticket_id_a = ? AND ticket_id_b = ? LIMIT 1")
        .get(ticketIdA, ticketIdB);

      if (!existing) {
        database
          .prepare(
            `INSERT INTO ticket_relations (
              id, ticket_id_a, ticket_id_b, relation_type, created_by, created_at
            ) VALUES (?, ?, ?, 'related', ?, datetime('now'))`
          )
          .run(uuidv4(), ticketIdA, ticketIdB, user.id);
      }

      return {
        created: !existing,
        items: this.getRelatedTickets({ ticketId, user })
      };
    },

    deleteTicketRelation({ ticketId, relatedTicketId, user }) {
      assertUserContext(user);

      if (user.role !== "developer") {
        throw createServiceError("forbidden", 403);
      }

      const sourceTicket = this.getTicketById({ ticketId });
      if (!sourceTicket) {
        throw createServiceError("ticket_not_found", 404);
      }

      const relatedTicket = this.getTicketById({ ticketId: relatedTicketId });
      if (!relatedTicket) {
        throw createServiceError("related_ticket_not_found", 404);
      }

      const [ticketIdA, ticketIdB] = normalizeRelationPair(ticketId, relatedTicketId);
      const result = database
        .prepare("DELETE FROM ticket_relations WHERE ticket_id_a = ? AND ticket_id_b = ?")
        .run(ticketIdA, ticketIdB);

      if (result.changes === 0) {
        throw createServiceError("ticket_relation_not_found", 404);
      }
    },

    getExternalReferences({ ticketId }) {
      return database
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
    },

    getTicketExternalReferences({ ticketId, user }) {
      getReadableTicketOrThrow({ database, ticketId, user });
      return this.getExternalReferences({ ticketId });
    },

    createTicketExternalReference({ ticketId, user, payload }) {
      assertUserContext(user);

      if (user.role !== "developer") {
        throw createServiceError("forbidden", 403);
      }

      const ticket = this.getTicketById({ ticketId });
      if (!ticket) {
        throw createServiceError("ticket_not_found", 404);
      }

      const id = uuidv4();
      const title = payload?.title ? String(payload.title).trim() : null;

      database
        .prepare(
          `INSERT INTO ticket_external_references (
            id, ticket_id, ref_type, url, title, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .run(
          id,
          ticketId,
          payload.ref_type,
          String(payload.url).trim(),
          title || null,
          user.id
        );

      return this.getExternalReferences({ ticketId });
    },

    deleteTicketExternalReference({ ticketId, refId, user }) {
      assertUserContext(user);

      if (user.role !== "developer") {
        throw createServiceError("forbidden", 403);
      }

      const ticket = this.getTicketById({ ticketId });
      if (!ticket) {
        throw createServiceError("ticket_not_found", 404);
      }

      const result = database
        .prepare("DELETE FROM ticket_external_references WHERE id = ? AND ticket_id = ?")
        .run(refId, ticketId);

      if (result.changes === 0) {
        throw createServiceError("external_reference_not_found", 404);
      }
    },

    createTicketAttachments({ ticketId, user, files, maxUploadBytesTotal }) {
      getReadableTicketOrThrow({ database, ticketId, user });

      if (!Array.isArray(files) || files.length === 0) {
        throw createServiceError("attachments_required", 400);
      }

      const totalSize = files.reduce((sum, file) => sum + Number(file?.size || 0), 0);
      if (Number.isFinite(maxUploadBytesTotal) && totalSize > maxUploadBytesTotal) {
        throw createServiceError("attachments_too_large", 400);
      }

      const insertAttachment = database.prepare(
        `INSERT INTO attachments (
          id, ticket_id, filename, original_name,
          mime_type, size, uploaded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      );
      const selectAttachment = database.prepare("SELECT * FROM attachments WHERE id = ?");
      const created = [];

      const tx = database.transaction(() => {
        for (const file of files) {
          const attachmentId = uuidv4();
          insertAttachment.run(
            attachmentId,
            ticketId,
            file.filename,
            file.originalname,
            file.mimetype,
            file.size,
            user.id
          );
          created.push(selectAttachment.get(attachmentId));
        }
      });

      tx();
      return created;
    },

    getTicketDetail({ ticketId, user }) {
      const ticket = getReadableTicketOrThrow({ database, ticketId, user });

      const commentsQuery =
        user.role === "developer"
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

      const comments = database.prepare(commentsQuery).all(ticket.id);
      const attachments = database
        .prepare("SELECT * FROM attachments WHERE ticket_id = ? ORDER BY created_at ASC")
        .all(ticket.id);
      const history = database
        .prepare(
          `SELECT h.*, u.name AS user_name, u.email AS user_email
           FROM ticket_history h
           LEFT JOIN users u ON u.id = h.user_id
           WHERE h.ticket_id = ?
           ORDER BY h.created_at DESC`
        )
        .all(ticket.id);
      const relatedTickets = this.getRelatedTickets({
        ticketId: ticket.id,
        user
      });
      const externalReferences = this.getExternalReferences({
        ticketId: ticket.id
      });

      return {
        ...ticket,
        comments,
        attachments,
        history,
        related_tickets: relatedTickets,
        external_references: externalReferences
      };
    },

    listTickets({ user, query }) {
      const filters = [];
      const params = [];

      assertUserContext(user);

      if (user.role !== "developer" || query?.my === "1") {
        filters.push("t.reporter_id = ?");
        params.push(user.id);
      }

      if (query?.status) {
        filters.push("t.status = ?");
        params.push(query.status);
      }

      if (query?.priority) {
        filters.push("t.priority = ?");
        params.push(query.priority);
      }

      if (query?.category) {
        filters.push("t.category = ?");
        params.push(query.category);
      }

      if (query?.project_id) {
        filters.push("t.project_id = ?");
        params.push(query.project_id);
      }

      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

      return database
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
    },

    getBoard() {
      return buildBoardPayload(database);
    },

    getWorkload({ user }) {
      assertUserContext(user);

      const rows = database
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

      const canOpenAll = user.role === "developer";

      for (const row of rows) {
        const ticket = {
          ...row,
          can_open: canOpenAll || row.reporter_id === user.id
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

      return payload;
    },

    getOverviewStats() {
      const counts = database
        .prepare("SELECT status, COUNT(*) AS count FROM tickets GROUP BY status")
        .all()
        .reduce((acc, row) => {
          acc[row.status] = row.count;
          return acc;
        }, {});

      const closedToday = database
        .prepare(
          `SELECT COUNT(*) AS count
           FROM tickets
           WHERE status = 'closed'
             AND closed_at IS NOT NULL
             AND date(closed_at) = date('now')`
        )
        .get().count;

      return {
        in_progress: counts.in_progress || 0,
        waiting: counts.waiting || 0,
        submitted: counts.submitted || 0,
        verified: counts.verified || 0,
        blocked: counts.blocked || 0,
        closed_today: closedToday || 0
      };
    },

    getActivationStats() {
      const users = database
        .prepare(
          `SELECT id, created_at
           FROM users
           WHERE role = 'user'`
        )
        .all();

      const tickets = database
        .prepare(
          `SELECT id, reporter_id, created_at
           FROM tickets
           ORDER BY datetime(created_at) ASC, id ASC`
        )
        .all();

      const assignmentHistory = database
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
    },

    getUsageStats() {
      const allEventsCount = database
        .prepare(
          `SELECT COUNT(*) AS count
           FROM telemetry_events
           WHERE datetime(created_at) >= datetime('now', '-30 days')`
        )
        .get().count;

      const knownEventsCount = database
        .prepare(
          `SELECT COUNT(*) AS count
           FROM telemetry_events
           WHERE event_name IN (${Array.from(TELEMETRY_EVENT_NAMES).map((name) => `'${name}'`).join(", ")})
             AND datetime(created_at) >= datetime('now', '-30 days')`
        )
        .get().count;

      const payload = buildFeatureUsageStats(database);
      payload.known_events_coverage_30d = {
        known_events_count: Number(knownEventsCount) || 0,
        all_events_count: Number(allEventsCount) || 0,
        coverage_percent:
          Number(allEventsCount) > 0
            ? roundToTwo((Number(knownEventsCount) / Number(allEventsCount)) * 100)
            : 100
      };

      return payload;
    },

    getClosureSummaryIndexFeed({ limit = 200, updatedSince = null }) {
      return buildClosureSummaryIndexFeed(database, {
        limit,
        updatedSince
      });
    }
  };
}

const ticketsService = createTicketsService();

module.exports = {
  createTicketsService,
  ticketsService
};
