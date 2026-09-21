// Validation for project-scoped custom ticket fields.
//
// This is a MECHANISM. It knows nothing about any particular deployment's
// vocabulary — a deployment layer supplies its own field definitions as data.
// Anything needing a business term to describe it belongs in a layer, not here.
//
// See docs/extensions/layer-contract.md for why that split matters.

const FIELD_TYPES = ["text", "number", "select", "url", "date"];
const MAX_FIELDS_PER_PROJECT = 20;
const MAX_OPTIONS = 50;
const MAX_VALUE_LENGTH = 2000;

const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class CustomFieldError extends Error {
  constructor(code, message, field) {
    super(message);
    this.code = code;
    this.field = field;
    // The global error handler reads status/code/details, so a bad custom field
    // surfaces as a 400 naming the field rather than an opaque 500.
    this.status = 400;
    this.details = [{ path: ["custom_fields", field], message, code }];
  }
}

function validateDefinition(definition) {
  const { field_key: fieldKey, label, field_type: fieldType, options } = definition;

  if (!FIELD_KEY_PATTERN.test(String(fieldKey || ""))) {
    throw new CustomFieldError(
      "invalid_field_key",
      "Field key must start with a letter and contain only lowercase letters, digits and underscores",
      fieldKey
    );
  }

  if (!String(label || "").trim()) {
    throw new CustomFieldError("invalid_field_label", "Field label is required", fieldKey);
  }

  if (!FIELD_TYPES.includes(fieldType)) {
    throw new CustomFieldError(
      "invalid_field_type",
      `Field type must be one of: ${FIELD_TYPES.join(", ")}`,
      fieldKey
    );
  }

  if (fieldType === "select") {
    if (!Array.isArray(options) || options.length === 0) {
      throw new CustomFieldError(
        "select_requires_options",
        "A select field must declare at least one option",
        fieldKey
      );
    }
    if (options.length > MAX_OPTIONS) {
      throw new CustomFieldError(
        "too_many_options",
        `A select field can declare at most ${MAX_OPTIONS} options`,
        fieldKey
      );
    }
    if (new Set(options).size !== options.length) {
      throw new CustomFieldError("duplicate_options", "Select options must be unique", fieldKey);
    }
  }

  return true;
}

function parseOptions(rawOptions) {
  if (!rawOptions) return [];
  try {
    const parsed = JSON.parse(rawOptions);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Returns the value to store, normalized. Throws CustomFieldError on bad input
// so the caller can surface a field-level message rather than a generic 400.
function validateValue(definition, rawValue) {
  const fieldKey = definition.field_key;
  const isEmpty = rawValue === undefined || rawValue === null || String(rawValue).trim() === "";

  if (isEmpty) {
    if (definition.required) {
      throw new CustomFieldError("field_required", `${definition.label} is required`, fieldKey);
    }
    return null;
  }

  const value = String(rawValue).trim();

  if (value.length > MAX_VALUE_LENGTH) {
    throw new CustomFieldError(
      "value_too_long",
      `${definition.label} must be at most ${MAX_VALUE_LENGTH} characters`,
      fieldKey
    );
  }

  switch (definition.field_type) {
    case "number": {
      if (!Number.isFinite(Number(value))) {
        throw new CustomFieldError(
          "invalid_number",
          `${definition.label} must be a number`,
          fieldKey
        );
      }
      return String(Number(value));
    }
    case "date": {
      // Pattern first, then a real date check: 2026-02-31 matches the shape but
      // is not a date, and Date() would quietly roll it over to March.
      if (!DATE_PATTERN.test(value)) {
        throw new CustomFieldError(
          "invalid_date",
          `${definition.label} must be a date in YYYY-MM-DD format`,
          fieldKey
        );
      }
      const [year, month, day] = value.split("-").map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
      ) {
        throw new CustomFieldError("invalid_date", `${definition.label} is not a real date`, fieldKey);
      }
      return value;
    }
    case "url": {
      let parsed;
      try {
        parsed = new URL(value);
      } catch {
        throw new CustomFieldError("invalid_url", `${definition.label} must be a URL`, fieldKey);
      }
      // Only http(s): a javascript: or data: URL rendered as a link is an XSS
      // vector, and these values are displayed to developers as clickable links.
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new CustomFieldError(
          "invalid_url",
          `${definition.label} must be an http or https URL`,
          fieldKey
        );
      }
      return parsed.toString();
    }
    case "select": {
      const options = parseOptions(definition.options);
      if (!options.includes(value)) {
        throw new CustomFieldError(
          "invalid_option",
          `${definition.label} must be one of: ${options.join(", ")}`,
          fieldKey
        );
      }
      return value;
    }
    default:
      return value;
  }
}

// Validates a whole submission against a project's active definitions.
// Unknown keys are rejected rather than ignored: silently dropping a value the
// caller believed was saved is worse than refusing it.
function validateSubmission(definitions, submitted = {}) {
  const byKey = new Map(definitions.map((definition) => [definition.field_key, definition]));

  for (const key of Object.keys(submitted)) {
    if (!byKey.has(key)) {
      throw new CustomFieldError("unknown_field", `Unknown custom field: ${key}`, key);
    }
  }

  const normalized = {};
  for (const definition of definitions) {
    const value = validateValue(definition, submitted[definition.field_key]);
    if (value !== null) {
      normalized[definition.field_key] = value;
    }
  }

  return normalized;
}

module.exports = {
  FIELD_TYPES,
  MAX_FIELDS_PER_PROJECT,
  MAX_OPTIONS,
  MAX_VALUE_LENGTH,
  CustomFieldError,
  validateDefinition,
  validateValue,
  validateSubmission,
  parseOptions
};
