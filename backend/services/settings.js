const db = require("../db");
const { SETTING_KEYS } = require("../constants");

const allowedSet = new Set(SETTING_KEYS);

function getSetting(key, fallback = null) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

function parseJsonSetting(key, fallback) {
  const raw = getSetting(key, null);
  if (raw == null) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function getSettingsMap(keys = SETTING_KEYS) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return {};
  }

  const placeholders = keys.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    .all(...keys);

  const map = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

function updateSettings(changes) {
  const entries = Object.entries(changes || {}).filter(([key]) => allowedSet.has(key));
  if (entries.length === 0) {
    return 0;
  }

  const tx = db.transaction(() => {
    const stmt = db.prepare("UPDATE settings SET value = ? WHERE key = ?");
    let changed = 0;
    for (const [key, value] of entries) {
      const result = stmt.run(String(value), key);
      changed += result.changes;
    }
    return changed;
  });

  return tx();
}

module.exports = {
  getSetting,
  parseJsonSetting,
  getSettingsMap,
  updateSettings
};
