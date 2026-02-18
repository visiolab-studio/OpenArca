const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");

const router = express.Router();

const listQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  project_id: z.string().uuid().optional(),
  my: z.enum(["0", "1"]).optional()
});

const idParamsSchema = z.object({
  id: z.string().uuid()
});
const writeBodySchema = z.object({}).passthrough();

router.get("/", authRequired, validate({ query: listQuerySchema }), (req, res) => {
  const filters = [];
  const params = [];

  if (req.user.role !== "developer" || req.query.my === "1") {
    filters.push("reporter_id = ?");
    params.push(req.user.id);
  }

  if (req.query.status) {
    filters.push("status = ?");
    params.push(req.query.status);
  }

  if (req.query.priority) {
    filters.push("priority = ?");
    params.push(req.query.priority);
  }

  if (req.query.category) {
    filters.push("category = ?");
    params.push(req.query.category);
  }

  if (req.query.project_id) {
    filters.push("project_id = ?");
    params.push(req.query.project_id);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT id, number, title, category, priority, status, project_id, reporter_id, assignee_id, planned_date, created_at, updated_at FROM tickets ${where} ORDER BY updated_at DESC LIMIT 200`
    )
    .all(...params);

  return res.json(rows);
});

router.get("/board", authRequired, (req, res) => {
  const statuses = ["submitted", "verified", "in_progress", "waiting", "blocked", "closed"];
  const payload = Object.fromEntries(statuses.map((status) => [status, []]));
  const rows = db
    .prepare("SELECT id, number, title, status, priority, project_id, reporter_id, planned_date FROM tickets ORDER BY updated_at DESC")
    .all();

  for (const row of rows) {
    if (payload[row.status]) {
      payload[row.status].push(row);
    }
  }

  payload._stats = statuses.reduce((acc, key) => {
    acc[key] = payload[key].length;
    return acc;
  }, {});

  return res.json(payload);
});

router.get("/stats/overview", authRequired, (req, res) => {
  const counts = db
    .prepare("SELECT status, COUNT(*) as count FROM tickets GROUP BY status")
    .all()
    .reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});

  return res.json({
    in_progress: counts.in_progress || 0,
    waiting: counts.waiting || 0,
    submitted: counts.submitted || 0,
    verified: counts.verified || 0,
    blocked: counts.blocked || 0,
    closed_today: counts.closed || 0
  });
});

router.get("/:id", authRequired, validate({ params: idParamsSchema }), (req, res) => {
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: "ticket_not_found" });
  }

  if (req.user.role !== "developer" && ticket.reporter_id !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }

  const comments = db
    .prepare(
      req.user.role === "developer"
        ? "SELECT * FROM comments WHERE ticket_id = ? ORDER BY created_at ASC"
        : "SELECT * FROM comments WHERE ticket_id = ? AND is_internal = 0 ORDER BY created_at ASC"
    )
    .all(ticket.id);

  const attachments = db.prepare("SELECT * FROM attachments WHERE ticket_id = ? ORDER BY created_at ASC").all(ticket.id);
  const history = db.prepare("SELECT * FROM ticket_history WHERE ticket_id = ? ORDER BY created_at DESC").all(ticket.id);

  return res.json({ ...ticket, comments, attachments, history });
});

router.post("/", authRequired, writeLimiter, validate({ body: writeBodySchema }), (req, res) => {
  return res.status(501).json({ error: "not_implemented" });
});

router.patch(
  "/:id",
  authRequired,
  writeLimiter,
  validate({ params: idParamsSchema, body: writeBodySchema }),
  (req, res) => {
  return res.status(501).json({ error: "not_implemented" });
  }
);

router.post(
  "/:id/comments",
  authRequired,
  writeLimiter,
  validate({ params: idParamsSchema, body: writeBodySchema }),
  (req, res) => {
    return res.status(501).json({ error: "not_implemented" });
  }
);

router.post("/:id/attachments", authRequired, writeLimiter, validate({ params: idParamsSchema }), (req, res) => {
  return res.status(501).json({ error: "not_implemented" });
});

module.exports = router;
