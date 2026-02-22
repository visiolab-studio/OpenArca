const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const TELEMETRY_EVENT_NAMES = new Set([
  "ticket.created",
  "ticket.closed",
  "board.drag",
  "devtodo.reorder",
  "closure_summary_added"
]);

function normalizeProperties(properties) {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return null;
  }

  const payload = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    if (value == null) {
      payload[key] = null;
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      payload[key] = value;
      continue;
    }

    payload[key] = String(value);
  }

  return Object.keys(payload).length ? payload : null;
}

function trackTelemetryEvent({ eventName, userId = null, ticketId = null, properties = null }) {
  if (!TELEMETRY_EVENT_NAMES.has(eventName)) {
    return;
  }

  const normalizedProperties = normalizeProperties(properties);
  const propertiesJson = normalizedProperties ? JSON.stringify(normalizedProperties) : null;

  try {
    db.prepare(
      `INSERT INTO telemetry_events (
        id, event_name, user_id, ticket_id, properties_json, created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(uuidv4(), eventName, userId, ticketId, propertiesJson);
  } catch (error) {
    // Telemetry must not block primary business flow.
    console.error("telemetry_track_failed", {
      eventName,
      ticketId,
      userId,
      error: error?.message
    });
  }
}

module.exports = {
  TELEMETRY_EVENT_NAMES,
  trackTelemetryEvent
};
