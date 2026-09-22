const fs = require("fs");
const path = require("path");
const express = require("express");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { authRequired, requireRole, requireScope } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");
const { upload } = require("../middleware/uploads");
const { uploadsDir } = require("../config");
const { customFieldsService } = require("../services/custom-fields");
const { FIELD_TYPES, CustomFieldError } = require("../core/custom-fields");
const { createCategoriesService, CategoryError } = require("../core/categories");
const categoriesService = createCategoriesService({ db });

const router = express.Router();
const LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const iconFilenameRegex = /^[a-z0-9-]+(\.[a-z0-9]+)?$/i;

const idParamsSchema = z.object({ id: z.string().uuid() });
const customFieldParamsSchema = z.object({
  id: z.string().uuid(),
  fieldId: z.string().uuid()
});
const createCustomFieldSchema = z
  .object({
    field_key: z.string().trim().min(2).max(50),
    label: z.string().trim().min(1).max(120),
    field_type: z.enum(FIELD_TYPES).default("text"),
    required: z.boolean().optional().default(false),
    options: z.array(z.string().trim().min(1).max(120)).optional(),
    position: z.number().int().min(0).max(999).optional()
  })
  .strict();
const createProjectSchema = z
  .object({
    public_intake_enabled: z.boolean().optional(),
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

router.get("/", authRequired, requireScope("projects:read"), (req, res) => {
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

// Custom field definitions are project-scoped configuration, so they are managed
// where projects are. The values themselves live with the ticket.
router.get(
  "/:id/custom-fields",
  authRequired,
  validate({ params: idParamsSchema }),
  (req, res) => {
    const includeArchived = req.user?.role === "developer" && req.query.include_archived === "true";
    return res.json({
      items: customFieldsService.listDefinitions({ projectId: req.params.id, includeArchived })
    });
  }
);

router.post(
  "/:id/custom-fields",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema, body: createCustomFieldSchema }),
  (req, res, next) => {
    try {
      const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "project_not_found" });
      }
      const definition = customFieldsService.createDefinition({
        projectId: req.params.id,
        payload: req.body
      });
      return res.status(201).json(definition);
    } catch (error) {
      if (error instanceof CustomFieldError) {
        return res.status(400).json({ error: error.code, field: error.field, message: error.message });
      }
      return next(error);
    }
  }
);

// Archives rather than deletes: removing the definition would take its ticket
// values with it, silently changing the history of closed tickets.
router.delete(
  "/:id/custom-fields/:fieldId",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: customFieldParamsSchema }),
  (req, res, next) => {
    try {
      customFieldsService.archiveDefinition({ id: req.params.fieldId });
      return res.status(204).send();
    } catch (error) {
      if (error instanceof CustomFieldError) {
        return res.status(404).json({ error: error.code, message: error.message });
      }
      return next(error);
    }
  }
);

// Kategorie zgloszen per projekt. Projekt, ktory nic nie skonfiguruje,
// zachowuje wbudowana piatke.
router.get(
  "/:id/categories",
  authRequired,
  validate({ params: idParamsSchema }),
  (req, res) => res.json({ items: categoriesService.describe(req.params.id) })
);

router.post(
  "/:id/categories",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema }),
  (req, res, next) => {
    try {
      return res.status(201).json(
        categoriesService.upsert({
          projectId: req.params.id,
          payload: {
            category_key: req.body?.category_key,
            label: req.body?.label,
            description: req.body?.description,
            icon: req.body?.icon,
            translations: req.body?.translations,
            simple_intake: req.body?.simple_intake,
            position: req.body?.position
          }
        })
      );
    } catch (error) {
      if (error instanceof CategoryError) {
        return res.status(400).json({ error: error.code, message: error.message });
      }
      return next(error);
    }
  }
);

// Archiwizuje, nie kasuje: zgloszenia zlozone w tej kategorii musza nadal sie
// poprawnie odczytywac.
router.delete(
  "/:id/categories/:key",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema.extend({ key: z.string().trim().min(1).max(40) }) }),
  (req, res, next) => {
    try {
      categoriesService.archive({ projectId: req.params.id, categoryKey: req.params.key });
      return res.status(204).send();
    } catch (error) {
      if (error instanceof CategoryError) {
        return res.status(404).json({ error: error.code, message: error.message });
      }
      return next(error);
    }
  }
);

module.exports = router;
