const { v4: uuidv4 } = require("uuid");
const defaultDb = require("../db");
const {
  MAX_FIELDS_PER_PROJECT,
  CustomFieldError,
  validateDefinition,
  validateSubmission,
  parseOptions
} = require("../core/custom-fields");

// Definitions are per project and are ARCHIVED rather than deleted. Removing a
// definition would take its ticket values with it, so history would silently
// change shape — the one thing a ticket system must not do.

function createCustomFieldsService(options = {}) {
  const db = options.db || defaultDb;

  function mapDefinition(row) {
    return {
      id: row.id,
      project_id: row.project_id,
      field_key: row.field_key,
      label: row.label,
      field_type: row.field_type,
      required: Boolean(row.required),
      options: parseOptions(row.options),
      position: row.position,
      archived: Boolean(row.archived_at)
    };
  }

  function listDefinitions({ projectId, includeArchived = false }) {
    if (!projectId) return [];

    const rows = db
      .prepare(
        `SELECT * FROM project_custom_fields
         WHERE project_id = ?
           ${includeArchived ? "" : "AND archived_at IS NULL"}
         ORDER BY position ASC, created_at ASC`
      )
      .all(projectId);

    return rows.map(mapDefinition);
  }

  function getDefinitionRows({ projectId }) {
    if (!projectId) return [];
    return db
      .prepare(
        `SELECT * FROM project_custom_fields
         WHERE project_id = ? AND archived_at IS NULL
         ORDER BY position ASC, created_at ASC`
      )
      .all(projectId);
  }

  function createDefinition({ projectId, payload }) {
    validateDefinition(payload);

    const activeCount = db
      .prepare(
        "SELECT COUNT(*) AS count FROM project_custom_fields WHERE project_id = ? AND archived_at IS NULL"
      )
      .get(projectId).count;

    if (activeCount >= MAX_FIELDS_PER_PROJECT) {
      throw new CustomFieldError(
        "too_many_fields",
        `A project can have at most ${MAX_FIELDS_PER_PROJECT} active custom fields`,
        payload.field_key
      );
    }

    const existing = db
      .prepare("SELECT id, archived_at, field_type FROM project_custom_fields WHERE project_id = ? AND field_key = ?")
      .get(projectId, payload.field_key);

    if (existing) {
      if (!existing.archived_at) {
        throw new CustomFieldError(
          "duplicate_field_key",
          `Field key "${payload.field_key}" already exists in this project`,
          payload.field_key
        );
      }
      // Reviving an archived key keeps its historical values attached, which is
      // the whole reason archiving exists — and is exactly why the type may not
      // change. Values stored under the old type were validated under the old
      // type: a text field holding "javascript:alert(1)" would become a url
      // field rendering it as an href.
      if (existing.field_type !== payload.field_type) {
        throw new CustomFieldError(
          "field_type_change_forbidden",
          `Field "${payload.field_key}" already exists as ${existing.field_type} and holds values validated as ${existing.field_type}. Use a new field key instead.`,
          payload.field_key
        );
      }
      db.prepare(
        `UPDATE project_custom_fields
         SET label = ?, field_type = ?, required = ?, options = ?, position = ?, archived_at = NULL
         WHERE id = ?`
      ).run(
        payload.label.trim(),
        payload.field_type,
        payload.required ? 1 : 0,
        payload.options ? JSON.stringify(payload.options) : null,
        payload.position ?? activeCount,
        existing.id
      );
      return getDefinition(existing.id);
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO project_custom_fields
         (id, project_id, field_key, label, field_type, required, options, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      projectId,
      payload.field_key,
      payload.label.trim(),
      payload.field_type,
      payload.required ? 1 : 0,
      payload.options ? JSON.stringify(payload.options) : null,
      payload.position ?? activeCount
    );

    return getDefinition(id);
  }

  function getDefinition(id) {
    const row = db.prepare("SELECT * FROM project_custom_fields WHERE id = ?").get(id);
    return row ? mapDefinition(row) : null;
  }

  function archiveDefinition({ id }) {
    const row = db.prepare("SELECT * FROM project_custom_fields WHERE id = ?").get(id);
    if (!row) {
      throw new CustomFieldError("field_not_found", "Custom field was not found", id);
    }
    db.prepare("UPDATE project_custom_fields SET archived_at = datetime('now') WHERE id = ?").run(id);
    return { archived: true };
  }

  // Values are returned for every field that HAS a value, including archived
  // definitions, so a ticket created before a field was archived still reads
  // correctly. Definitions added later simply have no value on older tickets.
  function getTicketValues({ ticketId }) {
    const rows = db
      .prepare(
        `SELECT f.field_key, f.label, f.field_type, f.options, f.archived_at, v.value
         FROM ticket_custom_field_values v
         JOIN project_custom_fields f ON f.id = v.field_id
         WHERE v.ticket_id = ?
         ORDER BY f.position ASC, f.created_at ASC`
      )
      .all(ticketId);

    return rows.map((row) => ({
      field_key: row.field_key,
      label: row.label,
      field_type: row.field_type,
      options: parseOptions(row.options),
      archived: Boolean(row.archived_at),
      value: row.value
    }));
  }

  function setTicketValues({ ticketId, projectId, submitted }) {
    const definitionRows = getDefinitionRows({ projectId });

    if (definitionRows.length === 0) {
      if (submitted && Object.keys(submitted).length > 0) {
        throw new CustomFieldError(
          "unknown_field",
          "This project has no custom fields",
          Object.keys(submitted)[0]
        );
      }
      return {};
    }

    const normalized = validateSubmission(definitionRows, submitted || {});
    const byKey = new Map(definitionRows.map((row) => [row.field_key, row]));

    const write = db.transaction(() => {
      for (const definition of definitionRows) {
        const value = normalized[definition.field_key];
        if (value === undefined) {
          db.prepare("DELETE FROM ticket_custom_field_values WHERE ticket_id = ? AND field_id = ?").run(
            ticketId,
            definition.id
          );
          continue;
        }

        db.prepare(
          `INSERT INTO ticket_custom_field_values (id, ticket_id, field_id, value, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(ticket_id, field_id)
           DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).run(uuidv4(), ticketId, byKey.get(definition.field_key).id, value);
      }
    });

    write();
    return normalized;
  }

  return {
    listDefinitions,
    createDefinition,
    getDefinition,
    archiveDefinition,
    getTicketValues,
    setTicketValues
  };
}

const customFieldsService = createCustomFieldsService();

module.exports = {
  createCustomFieldsService,
  customFieldsService
};
