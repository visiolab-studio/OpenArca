const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");

const router = express.Router();

const idParamsSchema = z.object({ id: z.string().uuid() });
const patchUserSchema = z
  .object({
    role: z.enum(["user", "developer"]).optional(),
    name: z.string().trim().min(1).max(120).nullable().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided"
  });

router.use(authRequired, requireRole("developer"));

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, email, name, role, language, created_at, last_login FROM users ORDER BY created_at DESC"
    )
    .all();
  return res.json(rows);
});

router.patch(
  "/:id",
  writeLimiter,
  validate({ params: idParamsSchema, body: patchUserSchema }),
  (req, res) => {
    const target = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
    if (!target) {
      return res.status(404).json({ error: "user_not_found" });
    }

    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "role")) {
      updates.push("role = ?");
      values.push(req.body.role);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
      updates.push("name = ?");
      values.push(req.body.name);
    }

    values.push(req.params.id);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    const user = db
      .prepare(
        "SELECT id, email, name, role, language, created_at, last_login FROM users WHERE id = ?"
      )
      .get(req.params.id);

    return res.json(user);
  }
);

module.exports = router;
