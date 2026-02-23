const { EDITIONS, KNOWN_FEATURE_FLAGS } = require("../constants");
const { getSetting } = require("./settings");

const OPEN_CORE_DEFAULTS = Object.freeze({
  core_tickets: true,
  core_board: true,
  core_devtodo: true,
  core_admin: true,
  enterprise_automation: false,
  enterprise_sso_google: false,
  enterprise_sso_microsoft: false,
  enterprise_sso_saml: false,
  enterprise_audit_immutable: false,
  enterprise_audit_export: false,
  enterprise_data_retention: false,
  enterprise_custom_workflows: false,
  enterprise_multi_team: false,
  enterprise_ai_recall: false
});

function normalizeEdition(rawEdition) {
  return rawEdition === EDITIONS.ENTERPRISE ? EDITIONS.ENTERPRISE : EDITIONS.OPEN_CORE;
}

function parseFeatureFlags(rawFlags) {
  if (!rawFlags) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawFlags);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch (_error) {
    return {};
  }
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return null;
}

function getCapabilities() {
  const edition = normalizeEdition(getSetting("edition", EDITIONS.OPEN_CORE));
  const rawFlags = parseFeatureFlags(getSetting("feature_flags", "{}"));
  const capabilities = { ...OPEN_CORE_DEFAULTS };

  if (edition === EDITIONS.ENTERPRISE) {
    for (const key of KNOWN_FEATURE_FLAGS) {
      if (key.startsWith("enterprise_")) {
        capabilities[key] = true;
      }
    }
  }

  for (const key of KNOWN_FEATURE_FLAGS) {
    if (!Object.prototype.hasOwnProperty.call(rawFlags, key)) {
      continue;
    }

    const normalized = toBoolean(rawFlags[key]);
    if (normalized == null) {
      continue;
    }
    capabilities[key] = normalized;
  }

  return {
    edition,
    capabilities
  };
}

module.exports = {
  getCapabilities
};
