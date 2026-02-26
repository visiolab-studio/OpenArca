const fs = require("fs");
const path = require("path");
const express = require("express");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");
const { upload } = require("../middleware/uploads");
const { uploadsDir } = require("../config");

const router = express.Router();
const LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const iconFilenameRegex = /^[a-z0-9-]+(\.[a-z0-9]+)?$/i;

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

function buildProjectPayload(project) {
  if (!project) return null;

  const iconFilename = String(project.icon_filename || "").trim();
  const iconVersion = String(project.icon_updated_at || "").trim();

  return {
    ...project,
    icon_url: iconFilename
      ? `/api/projects/${project.id}/icon?v=${encodeURIComponent(iconVersion || "1")}`
      : null
  };
}

function removeFileIfExists(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_error) {
    // Best-effort cleanup.
  }
}

function getIconAbsolutePath(filename) {
  if (!iconFilenameRegex.test(filename)) {
    return null;
  }

  const root = path.resolve(uploadsDir);
  const filePath = path.resolve(path.join(root, filename));
  if (!filePath.startsWith(root)) {
    return null;
  }

  return filePath;
}

router.get("/", authRequired, (req, res) => {
  const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  return res.json(rows.map((project) => buildProjectPayload(project)));
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

    return res.status(201).json(buildProjectPayload(getProject(id)));
  }
);

router.get("/:id/icon", validate({ params: idParamsSchema }), (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    return res.status(404).json({ error: "project_not_found" });
  }

  const filename = String(project.icon_filename || "").trim();
  if (!filename) {
    return res.status(404).json({ error: "file_not_found" });
  }

  const filePath = getIconAbsolutePath(filename);
  if (!filePath) {
    return res.status(400).json({ error: "invalid_filename" });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "file_not_found" });
  }

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.sendFile(filePath);
});

router.post(
  "/:id/icon",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema }),
  upload.single("icon"),
  (req, res, next) => {
    try {
      const project = getProject(req.params.id);
      if (!project) {
        if (req.file?.path) {
          removeFileIfExists(req.file.path);
        }
        return res.status(404).json({ error: "project_not_found" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "validation_error" });
      }

      if (!LOGO_MIME_TYPES.has(req.file.mimetype)) {
        removeFileIfExists(req.file.path);
        return res.status(400).json({ error: "unsupported_file_type" });
      }

      const currentFilename = String(project.icon_filename || "").trim();
      const nowIso = new Date().toISOString();

      db.prepare("UPDATE projects SET icon_filename = ?, icon_updated_at = ? WHERE id = ?").run(
        req.file.filename,
        nowIso,
        req.params.id
      );

      if (currentFilename && currentFilename !== req.file.filename) {
        const oldPath = getIconAbsolutePath(currentFilename);
        removeFileIfExists(oldPath);
      }

      return res.json(buildProjectPayload(getProject(req.params.id)));
    } catch (error) {
      if (req.file?.path) {
        removeFileIfExists(req.file.path);
      }
      return next(error);
    }
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
    return res.json(buildProjectPayload(getProject(req.params.id)));
  }
);

router.delete(
  "/:id/icon",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema }),
  (req, res) => {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "project_not_found" });
    }

    const currentFilename = String(project.icon_filename || "").trim();
    db.prepare("UPDATE projects SET icon_filename = NULL, icon_updated_at = NULL WHERE id = ?").run(req.params.id);

    if (currentFilename) {
      const oldPath = getIconAbsolutePath(currentFilename);
      removeFileIfExists(oldPath);
    }

    return res.status(204).send();
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

    const currentFilename = String(project.icon_filename || "").trim();
    if (currentFilename) {
      const oldPath = getIconAbsolutePath(currentFilename);
      removeFileIfExists(oldPath);
    }

    return res.status(204).send();
  }
);

module.exports = router;
