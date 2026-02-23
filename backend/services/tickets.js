const db = require("../db");

function assertUserContext(user) {
  if (!user || !user.id || !user.role) {
    throw new Error("invalid_user_context");
  }
}

function createTicketsService(options = {}) {
  const database = options.db || db;

  return {
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
    }
  };
}

const ticketsService = createTicketsService();

module.exports = {
  createTicketsService,
  ticketsService
};
