const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");

const router = express.Router();

const idParamsSchema = z.object({ id: z.string().uuid() });
const writeBodySchema = z.object({}).passthrough();

router.use(authRequired, requireRole("developer"));

router.get("/", (req, res) => {
  const active = db
    .prepare("SELECT * FROM dev_tasks WHERE status IN ('todo', 'in_progress') ORDER BY order_index ASC")
    .all();
  const done = db
    .prepare("SELECT * FROM dev_tasks WHERE status = 'done' ORDER BY updated_at DESC LIMIT 20")
    .all();
  return res.json({ active, done });
});

router.post("/", writeLimiter, validate({ body: writeBodySchema }), (req, res) => res.status(501).json({ error: "not_implemented" }));
router.patch(
  "/:id",
  writeLimiter,
  validate({ params: idParamsSchema, body: writeBodySchema }),
  (req, res) => res.status(501).json({ error: "not_implemented" })
);
router.delete("/:id", writeLimiter, validate({ params: idParamsSchema }), (req, res) => res.status(501).json({ error: "not_implemented" }));
router.post("/reorder", writeLimiter, validate({ body: writeBodySchema }), (req, res) => res.status(501).json({ error: "not_implemented" }));

module.exports = router;
