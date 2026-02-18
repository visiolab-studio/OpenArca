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
  const rows = db
    .prepare("SELECT id, email, name, role, language, created_at, last_login FROM users ORDER BY created_at DESC")
    .all();
  return res.json(rows);
});

router.patch("/:id", writeLimiter, validate({ params: idParamsSchema, body: writeBodySchema }), (req, res) => {
  return res.status(501).json({ error: "not_implemented" });
});

module.exports = router;
