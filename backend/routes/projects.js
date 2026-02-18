const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");

const router = express.Router();

const idParamsSchema = z.object({ id: z.string().uuid() });
const writeBodySchema = z.object({}).passthrough();

router.get("/", authRequired, (req, res) => {
  const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  return res.json(rows);
});

router.post("/", authRequired, requireRole("developer"), writeLimiter, validate({ body: writeBodySchema }), (req, res) =>
  res.status(501).json({ error: "not_implemented" })
);
router.patch(
  "/:id",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema, body: writeBodySchema }),
  (req, res) =>
  res.status(501).json({ error: "not_implemented" })
);
router.delete("/:id", authRequired, requireRole("developer"), writeLimiter, validate({ params: idParamsSchema }), (req, res) =>
  res.status(501).json({ error: "not_implemented" })
);

module.exports = router;
