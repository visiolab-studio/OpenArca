const { TICKET_CATEGORIES } = require("../constants");

// Ticket categories, configurable per project.
//
// The five built-in categories describe a generic workflow. A real deployment
// usually sorts tickets by WHO HANDLES THEM, not by the nature of the problem —
// billing, content and data lookups go to different people even when they are
// all technically "questions". A project that never configures anything keeps
// the built-in five, so nothing changes for an existing install.
//
// Categories are ARCHIVED rather than deleted, for the same reason as custom
// fields: removing one would orphan every ticket that used it.

const CORE_CATEGORY_KEYS = TICKET_CATEGORIES;

const CATEGORY_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

class CategoryError extends Error {
  constructor(code, message, key) {
    super(message);
    this.code = code;
    this.key = key;
    this.status = 400;
    this.details = [{ path: "category", message, code }];
  }
}

function installCategorySchema(db) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS project_categories (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      category_key TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      translations TEXT,
      simple_intake INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();

  db.prepare(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_project_categories_key ON project_categories(project_id, category_key)"
  ).run();
}

function parseTranslations(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validateDefinition({ category_key: key, label, icon }) {
  if (!CATEGORY_KEY_PATTERN.test(String(key || ""))) {
    throw new CategoryError(
      "invalid_category_key",
      "Category key must start with a letter and contain only lowercase letters, digits and underscores",
      key
    );
  }

  if (!String(label || "").trim()) {
    throw new CategoryError("invalid_category_label", "Category label is required", key);
  }

  if (icon != null && (typeof icon !== "string" || icon.trim().length > 24)) {
    throw new CategoryError("invalid_category_icon", "Category icon must be a short glyph", key);
  }

  return true;
}

function createCategoriesService(options = {}) {
  const db = options.db || require("../db");

  function listForProject(projectId) {
    if (!projectId) return [];
    return db
      .prepare(
        `SELECT category_key, label, description, icon, translations, simple_intake, position
         FROM project_categories
         WHERE project_id = ? AND archived_at IS NULL
         ORDER BY position ASC, created_at ASC`
      )
      .all(projectId);
  }

  // The effective list: a project's own categories when it has any, otherwise
  // the built-in five. There is deliberately no "merge" — a deployment that
  // defines its own taxonomy means it, and silently keeping `improvement`
  // around would undo the point of configuring anything.
  function effectiveKeys(projectId) {
    const configured = listForProject(projectId);
    return configured.length > 0
      ? configured.map((row) => row.category_key)
      : [...CORE_CATEGORY_KEYS];
  }

  function describe(projectId) {
    const configured = listForProject(projectId);
    if (configured.length > 0) {
      return configured.map((row) => ({
        key: row.category_key,
        label: row.label,
        // Jedno zdanie, ktore ma powiedziec zglaszajacemu, czy to ta kategoria.
        // Bez niego nazwy takie jak "Sprawdzenie danych" i "Tresc i katalog"
        // sa rozroznialne dopiero po kilku pomylkach.
        description: row.description || null,
        icon: row.icon || null,
        // Zwracamy caly zestaw, a klient wybiera po swoim jezyku. Negocjacja po
        // stronie serwera wymagalaby, zeby kazde zapytanie niosło jezyk, a UI
        // przelacza go bez przeladowania.
        translations: parseTranslations(row.translations),
        // Kategoria lekka: zglaszajacy podaje tytul, tresc i ewentualnie plik.
        // Bez tego "szybkie pytanie" przechodzi ten sam prog dlugosci opisu co
        // raport bledu i przestaje byc szybkie.
        simple_intake: row.simple_intake === 1,
        source: "project"
      }));
    }
    // No label: the UI falls back to its own dictionary for built-ins.
    return CORE_CATEGORY_KEYS.map((key) => ({
      key,
      label: null,
      description: null,
      icon: null,
      translations: null,
      simple_intake: false,
      source: "core"
    }));
  }

  function isSimpleIntake({ projectId, category }) {
    const row = listForProject(projectId).find((entry) => entry.category_key === category);
    return Boolean(row && row.simple_intake === 1);
  }

  function assertValid({ projectId, category }) {
    const allowed = effectiveKeys(projectId);
    if (!allowed.includes(category)) {
      throw new CategoryError(
        "invalid_category",
        `Category must be one of: ${allowed.join(", ")}`,
        category
      );
    }
    return category;
  }

  function upsert({ projectId, payload }) {
    validateDefinition(payload);

    const existing = db
      .prepare("SELECT id FROM project_categories WHERE project_id = ? AND category_key = ?")
      .get(projectId, payload.category_key);

    if (existing) {
      db.prepare(
        `UPDATE project_categories
         SET label = ?, description = ?, icon = ?, translations = ?, simple_intake = ?, position = ?, archived_at = NULL
         WHERE id = ?`
      ).run(
        payload.label.trim(),
        payload.description?.trim() || null,
        payload.icon?.trim() || null,
        payload.translations ? JSON.stringify(payload.translations) : null,
        payload.simple_intake ? 1 : 0,
        payload.position ?? 0,
        existing.id
      );
      return { id: existing.id, ...payload };
    }

    const { randomUUID } = require("node:crypto");
    const id = randomUUID();
    db.prepare(
      `INSERT INTO project_categories
         (id, project_id, category_key, label, description, icon, translations, simple_intake, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      projectId,
      payload.category_key,
      payload.label.trim(),
      payload.description?.trim() || null,
      payload.icon?.trim() || null,
      payload.translations ? JSON.stringify(payload.translations) : null,
      payload.simple_intake ? 1 : 0,
      payload.position ?? 0
    );

    return { id, ...payload };
  }

  function archive({ projectId, categoryKey }) {
    const result = db
      .prepare(
        "UPDATE project_categories SET archived_at = datetime('now') WHERE project_id = ? AND category_key = ?"
      )
      .run(projectId, categoryKey);

    if (result.changes === 0) {
      throw new CategoryError("category_not_found", "Category was not found", categoryKey);
    }
    return { archived: true };
  }

  return {
    listForProject,
    effectiveKeys,
    describe,
    isSimpleIntake,
    assertValid,
    upsert,
    archive
  };
}

module.exports = {
  CORE_CATEGORY_KEYS,
  parseTranslations,
  CategoryError,
  installCategorySchema,
  validateDefinition,
  createCategoriesService
};
