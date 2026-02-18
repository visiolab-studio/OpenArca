const express = require("express");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");

const router = express.Router();

const PRIORITY_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };

const idParamsSchema = z.object({ id: z.string().uuid() });
const createTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(4000).optional().nullable(),
    priority: z.enum(["critical", "high", "normal", "low"]).default("normal"),
    estimated_hours: z.coerce.number().min(0).max(10000).optional().nullable(),
    planned_date: z.string().trim().date().optional().nullable(),
    ticket_id: z.string().uuid().optional().nullable()
  })
  .strict();
const patchTaskSchema = createTaskSchema
  .extend({
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    order_index: z.coerce.number().int().min(0).optional()
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided"
  });
const reorderSchema = z.object({
  order: z
    .array(
      z
        .object({
          id: z.string().uuid(),
          order_index: z.coerce.number().int().min(0)
        })
        .strict()
    )
    .min(1)
    .max(1000)
}).strict();

router.use(authRequired, requireRole("developer"));

function getTask(id) {
  return db.prepare("SELECT * FROM dev_tasks WHERE id = ?").get(id);
}

function sortActiveTasks(items) {
  return [...items].sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;

    const aHasDate = Boolean(a.planned_date);
    const bHasDate = Boolean(b.planned_date);
    if (aHasDate !== bHasDate) {
      return aHasDate ? -1 : 1;
    }

    if (aHasDate && bHasDate) {
      const d = a.planned_date.localeCompare(b.planned_date);
      if (d !== 0) return d;
    }

    return (a.order_index || 0) - (b.order_index || 0);
  });
}

router.get("/", (req, res) => {
  const activeRows = db
    .prepare("SELECT * FROM dev_tasks WHERE status IN ('todo', 'in_progress')")
    .all();
  const done = db
    .prepare("SELECT * FROM dev_tasks WHERE status = 'done' ORDER BY updated_at DESC LIMIT 20")
    .all();
  const active = sortActiveTasks(activeRows);
  return res.json({ active, done });
});

router.post("/", writeLimiter, validate({ body: createTaskSchema }), (req, res) => {
  if (req.body.ticket_id) {
    const ticketExists = db
      .prepare("SELECT 1 FROM tickets WHERE id = ?")
      .get(req.body.ticket_id);
    if (!ticketExists) {
      return res.status(400).json({ error: "ticket_not_found" });
    }
  }

  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(order_index), -1) AS max_order FROM dev_tasks WHERE status IN ('todo', 'in_progress')")
    .get().max_order;

  const id = uuidv4();
  db.prepare(
    `INSERT INTO dev_tasks (
      id, title, description, priority, estimated_hours, planned_date,
      status, order_index, ticket_id, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(
    id,
    req.body.title,
    req.body.description || null,
    req.body.priority || "normal",
    req.body.estimated_hours ?? null,
    req.body.planned_date || null,
    Number(maxOrder) + 1,
    req.body.ticket_id || null,
    req.user.id
  );

  return res.status(201).json(getTask(id));
});

router.patch(
  "/:id",
  writeLimiter,
  validate({ params: idParamsSchema, body: patchTaskSchema }),
  (req, res) => {
    const task = getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "task_not_found" });
    }

    if (req.body.ticket_id) {
      const ticketExists = db
        .prepare("SELECT 1 FROM tickets WHERE id = ?")
        .get(req.body.ticket_id);
      if (!ticketExists) {
        return res.status(400).json({ error: "ticket_not_found" });
      }
    }

    const updates = [];
    const values = [];

    const updatable = [
      "title",
      "description",
      "priority",
      "estimated_hours",
      "planned_date",
      "status",
      "order_index",
      "ticket_id"
    ];

    for (const key of updatable) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates.push(`${key} = ?`);
        values.push(req.body[key] ?? null);
      }
    }

    updates.push("updated_at = datetime('now')");
    values.push(req.params.id);

    db.prepare(`UPDATE dev_tasks SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    return res.json(getTask(req.params.id));
  }
);

router.delete(
  "/:id",
  writeLimiter,
  validate({ params: idParamsSchema }),
  (req, res) => {
    const task = getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "task_not_found" });
    }

    db.prepare("DELETE FROM dev_tasks WHERE id = ?").run(req.params.id);
    return res.status(204).send();
  }
);

router.post("/reorder", writeLimiter, validate({ body: reorderSchema }), (req, res) => {
  const tx = db.transaction(() => {
    const update = db.prepare(
      "UPDATE dev_tasks SET order_index = ?, updated_at = datetime('now') WHERE id = ? AND status IN ('todo', 'in_progress')"
    );

    for (const item of req.body.order) {
      const result = update.run(item.order_index, item.id);
      if (result.changes === 0) {
        const err = new Error("Task not found or not active");
        err.status = 400;
        err.code = "invalid_task_order";
        throw err;
      }
    }
  });

  tx();

  const activeRows = db
    .prepare("SELECT * FROM dev_tasks WHERE status IN ('todo', 'in_progress')")
    .all();

  return res.json({ active: sortActiveTasks(activeRows) });
});

module.exports = router;
