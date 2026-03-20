const express = require("express");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");
const { TICKET_CATEGORIES, TICKET_PRIORITIES } = require("../constants");

const router = express.Router();

const idParamsSchema = z.object({ id: z.string().uuid() });
const checklistItemSchema = z.string().trim().min(1).max(200);
const projectIdSchema = z.string().uuid().nullable().optional();

const baseTemplateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    project_id: projectIdSchema,
    category: z.enum(TICKET_CATEGORIES),
    urgency_reporter: z.enum(TICKET_PRIORITIES).optional(),
    title_template: z.string().trim().min(5).max(160),
    description_template: z.string().trim().min(20).max(4000),
    checklist_items: z.array(checklistItemSchema).max(12).optional(),
    is_active: z.boolean().optional()
  })
  .strict();

const createTemplateSchema = baseTemplateSchema;
const patchTemplateSchema = baseTemplateSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "No changes provided"
});

const listTemplatesQuerySchema = z
  .object({
    project_id: z.string().uuid().optional(),
    include_inactive: z.enum(["0", "1"]).optional()
  })
  .strict();

function parseChecklist(rawValue) {
  try {
    const parsed = JSON.parse(String(rawValue || "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function buildTemplatePayload(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    project_id: row.project_id,
    project_name: row.project_name || null,
    category: row.category,
    urgency_reporter: row.urgency_reporter,
    title_template: row.title_template,
    description_template: row.description_template,
    checklist_items: parseChecklist(row.checklist_json),
    is_active: Boolean(row.is_active),
    created_by: row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function getProject(projectId) {
  return db.prepare("SELECT id, name FROM projects WHERE id = ?").get(projectId);
}

function getTemplate(templateId) {
  return db
    .prepare(
      `SELECT tt.*, p.name AS project_name
       FROM ticket_templates tt
       LEFT JOIN projects p ON p.id = tt.project_id
       WHERE tt.id = ?`
    )
    .get(templateId);
}

function assertProjectExists(projectId) {
  if (!projectId) return;
  const project = getProject(projectId);
  if (!project) {
    const error = new Error("project_not_found");
    error.status = 404;
    error.code = "project_not_found";
    throw error;
  }
}

function listTemplates({ projectId = null, includeInactive = false, includeGlobalFallback = false }) {
  const params = [];
  const where = [];

  if (!includeInactive) {
    where.push("tt.is_active = 1");
  }

  if (projectId && includeGlobalFallback) {
    where.push("(tt.project_id = ? OR tt.project_id IS NULL)");
    params.push(projectId);
  } else if (projectId) {
    where.push("tt.project_id = ?");
    params.push(projectId);
  }

  const orderClause = projectId && includeGlobalFallback
    ? "ORDER BY CASE WHEN tt.project_id = ? THEN 0 ELSE 1 END, tt.name COLLATE NOCASE ASC, tt.created_at DESC"
    : "ORDER BY CASE WHEN tt.project_id IS NULL THEN 1 ELSE 0 END, tt.name COLLATE NOCASE ASC, tt.created_at DESC";

  const rows = db
    .prepare(
      `SELECT tt.*, p.name AS project_name
       FROM ticket_templates tt
       LEFT JOIN projects p ON p.id = tt.project_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ${orderClause}`
    )
    .all(...params, ...(projectId && includeGlobalFallback ? [projectId] : []));

  return rows.map((row) => buildTemplatePayload(row));
}

router.get(
  "/",
  authRequired,
  validate({ query: listTemplatesQuerySchema }),
  (req, res) => {
    const projectId = req.query.project_id ? String(req.query.project_id) : null;
    if (projectId) {
      assertProjectExists(projectId);
    }

    const includeInactive = req.user.role === "developer" && req.query.include_inactive === "1";
    const rows = listTemplates({
      projectId,
      includeInactive,
      includeGlobalFallback: Boolean(projectId)
    });

    return res.json(rows);
  }
);

router.get(
  "/:id",
  authRequired,
  validate({ params: idParamsSchema }),
  (req, res) => {
    const template = getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "ticket_template_not_found" });
    }

    if (!template.is_active && req.user.role !== "developer") {
      return res.status(404).json({ error: "ticket_template_not_found" });
    }

    return res.json(buildTemplatePayload(template));
  }
);

router.post(
  "/",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ body: createTemplateSchema }),
  (req, res, next) => {
    try {
      assertProjectExists(req.body.project_id || null);

      const id = uuidv4();
      db.prepare(
        `INSERT INTO ticket_templates (
          id, name, project_id, category, urgency_reporter, title_template, description_template,
          checklist_json, is_active, created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).run(
        id,
        req.body.name,
        req.body.project_id || null,
        req.body.category,
        req.body.urgency_reporter || "normal",
        req.body.title_template,
        req.body.description_template,
        JSON.stringify(req.body.checklist_items || []),
        req.body.is_active === false ? 0 : 1,
        req.user.id
      );

      return res.status(201).json(buildTemplatePayload(getTemplate(id)));
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/:id",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema, body: patchTemplateSchema }),
  (req, res, next) => {
    try {
      const template = getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "ticket_template_not_found" });
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "project_id")) {
        assertProjectExists(req.body.project_id || null);
      }

      const updates = [];
      const values = [];
      const directKeys = ["name", "project_id", "category", "urgency_reporter", "title_template", "description_template"];

      for (const key of directKeys) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          updates.push(`${key} = ?`);
          values.push(req.body[key] ?? null);
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "checklist_items")) {
        updates.push("checklist_json = ?");
        values.push(JSON.stringify(req.body.checklist_items || []));
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "is_active")) {
        updates.push("is_active = ?");
        values.push(req.body.is_active ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "no_changes" });
      }

      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);

      db.prepare(`UPDATE ticket_templates SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      return res.json(buildTemplatePayload(getTemplate(req.params.id)));
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  "/:id",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema }),
  (req, res) => {
    const template = getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "ticket_template_not_found" });
    }

    db.prepare("DELETE FROM ticket_templates WHERE id = ?").run(req.params.id);
    return res.status(204).send();
  }
);

module.exports = router;
