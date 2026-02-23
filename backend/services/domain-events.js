const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const OUTBOX_STATUSES = new Set(["pending", "processing", "failed", "sent"]);

function createDomainEventsService(options = {}) {
  const database = options.db || db;

  return {
    publishDomainEvent({
      eventName,
      aggregateType,
      aggregateId,
      actorUserId = null,
      payload = {},
      correlationId = null,
      source = "core",
      occurredAt = null
    }) {
      const normalizedEventName = String(eventName || "").trim();
      const normalizedAggregateType = String(aggregateType || "").trim();
      const normalizedAggregateId = String(aggregateId || "").trim();
      const normalizedSource = String(source || "core").trim() || "core";

      if (!normalizedEventName) {
        const error = new Error("event_name_required");
        error.code = "event_name_required";
        error.status = 400;
        throw error;
      }

      if (!normalizedAggregateType || !normalizedAggregateId) {
        const error = new Error("aggregate_reference_required");
        error.code = "aggregate_reference_required";
        error.status = 400;
        throw error;
      }

      const payloadJson = JSON.stringify(payload || {});
      const eventId = uuidv4();
      const outboxId = uuidv4();
      const effectiveOccurredAt = occurredAt || null;

      const tx = database.transaction(() => {
        database
          .prepare(
            `INSERT INTO domain_events (
              id,
              event_name,
              aggregate_type,
              aggregate_id,
              actor_user_id,
              payload_json,
              correlation_id,
              source,
              occurred_at,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`
          )
          .run(
            eventId,
            normalizedEventName,
            normalizedAggregateType,
            normalizedAggregateId,
            actorUserId || null,
            payloadJson,
            correlationId || null,
            normalizedSource,
            effectiveOccurredAt
          );

        database
          .prepare(
            `INSERT INTO event_outbox (
              id,
              event_id,
              event_name,
              payload_json,
              status,
              attempts,
              next_attempt_at,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, 'pending', 0, datetime('now'), datetime('now'), datetime('now'))`
          )
          .run(outboxId, eventId, normalizedEventName, payloadJson);
      });

      tx();

      return {
        outbox_id: outboxId,
        event_id: eventId,
        event_name: normalizedEventName,
        status: "pending"
      };
    },

    getOutboxEntries({ limit = 100, status = null } = {}) {
      const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
      const normalizedStatus = status == null ? null : String(status).trim();

      if (normalizedStatus && !OUTBOX_STATUSES.has(normalizedStatus)) {
        const error = new Error("invalid_outbox_status");
        error.code = "invalid_outbox_status";
        error.status = 400;
        throw error;
      }

      const params = [];
      let where = "";
      if (normalizedStatus) {
        where = "WHERE o.status = ?";
        params.push(normalizedStatus);
      }
      params.push(normalizedLimit);

      const items = database
        .prepare(
          `SELECT
             o.id,
             o.event_id,
             o.event_name,
             o.status,
             o.attempts,
             o.next_attempt_at,
             o.last_error,
             o.created_at,
             o.updated_at,
             o.processed_at,
             e.aggregate_type,
             e.aggregate_id,
             e.actor_user_id,
             e.correlation_id,
             e.source,
             e.occurred_at
           FROM event_outbox o
           JOIN domain_events e ON e.id = o.event_id
           ${where}
           ORDER BY datetime(o.created_at) DESC
           LIMIT ?`
        )
        .all(...params);

      return {
        generated_at: new Date().toISOString(),
        count: items.length,
        items
      };
    }
  };
}

const domainEventsService = createDomainEventsService();

module.exports = {
  createDomainEventsService,
  domainEventsService
};
