const { v4: uuidv4 } = require("uuid");
const db = require("../db");

function getNextActiveTaskOrderForUser({ database, userId, excludeTaskId = null }) {
  if (!userId) return 0;

  if (excludeTaskId) {
    const row = database
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

  const row = database
    .prepare(
      `SELECT COALESCE(MAX(order_index), -1) AS max_order
       FROM dev_tasks
       WHERE created_by = ?
         AND status IN ('todo', 'in_progress')`
    )
    .get(userId);
  return Number(row?.max_order || -1) + 1;
}

function createTaskSyncService(options = {}) {
  const database = options.db || db;

  return {
    ensureDevTaskForAcceptedTicket({ ticketId, userId, ticket }) {
      const desiredTaskStatus =
        ticket.status === "closed" || ticket.status === "waiting"
          ? "done"
          : (ticket.status === "in_progress" ? "in_progress" : "todo");

      const existing = database
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
          database
            .prepare("UPDATE dev_tasks SET status = ?, updated_at = datetime('now') WHERE id = ?")
            .run(desiredTaskStatus, existing.id);
        }
        return;
      }

      if (desiredTaskStatus === "done") {
        return;
      }

      const maxOrder = database
        .prepare(
          "SELECT COALESCE(MAX(order_index), -1) AS max_order FROM dev_tasks WHERE created_by = ? AND status IN ('todo', 'in_progress')"
        )
        .get(userId).max_order;

      const taskTitle = String(ticket.title || `Ticket #${ticket.number || ""}`)
        .slice(0, 200)
        .trim();

      database
        .prepare(
          `INSERT INTO dev_tasks (
            id, title, description, priority, estimated_hours, planned_date,
            status, order_index, ticket_id, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .run(
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
    },

    normalizeLinkedDevTasksForTicket({ ticketId, assigneeId }) {
      const activeLinkedTasks = database
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
        database
          .prepare("DELETE FROM dev_tasks WHERE ticket_id = ? AND status IN ('todo', 'in_progress')")
          .run(ticketId);
        return;
      }

      const keepTask = activeLinkedTasks.find((task) => task.created_by === assigneeId);
      if (keepTask) {
        database
          .prepare(
            `DELETE FROM dev_tasks
             WHERE ticket_id = ?
               AND status IN ('todo', 'in_progress')
               AND id != ?`
          )
          .run(ticketId, keepTask.id);
        return;
      }

      const taskToTransfer = activeLinkedTasks[0];
      const nextOrder = getNextActiveTaskOrderForUser({
        database,
        userId: assigneeId,
        excludeTaskId: taskToTransfer.id
      });

      database
        .prepare(
          `UPDATE dev_tasks
           SET created_by = ?, order_index = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(assigneeId, nextOrder, taskToTransfer.id);

      database
        .prepare(
          `DELETE FROM dev_tasks
           WHERE ticket_id = ?
             AND status IN ('todo', 'in_progress')
             AND id != ?`
        )
        .run(ticketId, taskToTransfer.id);
    }
  };
}

const taskSyncService = createTaskSyncService();

module.exports = {
  createTaskSyncService,
  taskSyncService
};
