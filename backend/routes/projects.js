const express = require("express");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");

const router = express.Router();

const idParamsSchema = z.object({ id: z.string().uuid() });
const createProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional().nullable(),
    color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional()
  })
  .strict();
const patchProjectSchema = createProjectSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "No changes provided"
});

function getProject(id) {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
}

router.get("/", authRequired, (req, res) => {
  const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  return res.json(rows);
});

router.post(
  "/",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ body: createProjectSchema }),
  (req, res) => {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO projects (id, name, description, color, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(id, req.body.name, req.body.description || null, req.body.color || "#6B7280");

    return res.status(201).json(getProject(id));
  }
);

router.patch(
  "/:id",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema, body: patchProjectSchema }),
  (req, res) => {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "project_not_found" });
    }

    const updates = [];
    const values = [];

    for (const key of ["name", "description", "color"]) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates.push(`${key} = ?`);
        values.push(req.body[key] ?? null);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "no_changes" });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    return res.json(getProject(req.params.id));
  }
);

router.delete(
  "/:id",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema }),
  (req, res) => {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "project_not_found" });
    }

    db.prepare("UPDATE tickets SET project_id = NULL WHERE project_id = ?").run(req.params.id);
    db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
    return res.status(204).send();
  }
);

module.exports = router;
