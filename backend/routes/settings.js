const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");

const router = express.Router();
const writeBodySchema = z.object({}).passthrough();

router.use(authRequired, requireRole("developer"));

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings ORDER BY key ASC").all();
  return res.json(rows);
});

router.patch("/", writeLimiter, validate({ body: writeBodySchema }), (req, res) => {
  return res.status(501).json({ error: "not_implemented" });
});

module.exports = router;
