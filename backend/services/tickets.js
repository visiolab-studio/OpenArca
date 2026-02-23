const db = require("../db");

function createTicketsService(options = {}) {
  const database = options.db || db;

  return {
    listTickets({ user, query }) {
      const filters = [];
      const params = [];

      if (!user || !user.id || !user.role) {
        throw new Error("invalid_user_context");
      }

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
    }
  };
}

const ticketsService = createTicketsService();

module.exports = {
  createTicketsService,
  ticketsService
};
