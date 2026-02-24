const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { createOutboxWorkerService } = require("../services/outbox-worker");

function createInMemoryDb() {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");

  database
    .prepare(
      `CREATE TABLE domain_events (
        id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        actor_user_id TEXT,
        payload_json TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'core',
        occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();

  database
    .prepare(
      `CREATE TABLE event_outbox (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL UNIQUE REFERENCES domain_events(id) ON DELETE CASCADE,
        event_name TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_error TEXT,
        processed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();

  return database;
}

function insertOutboxEntry(database, input = {}) {
  const eventId = input.eventId || `event-${Math.random().toString(36).slice(2, 10)}`;
  const outboxId = input.outboxId || `outbox-${Math.random().toString(36).slice(2, 10)}`;
  const eventName = input.eventName || "ticket.created";
  const payloadJson = input.payloadJson || JSON.stringify({ status: "submitted" });

  database
    .prepare(
      `INSERT INTO domain_events (
        id, event_name, aggregate_type, aggregate_id, actor_user_id, payload_json, source
      ) VALUES (?, ?, 'ticket', ?, 'dev-1', ?, 'core')`
    )
    .run(eventId, eventName, input.aggregateId || "ticket-1", payloadJson);

  database
    .prepare(
      `INSERT INTO event_outbox (
        id, event_id, event_name, payload_json, status, attempts, next_attempt_at, last_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      outboxId,
      eventId,
      eventName,
      payloadJson,
      input.status || "pending",
      Number(input.attempts) || 0,
      input.nextAttemptAt || "2026-02-24T10:00:00.000Z",
      input.lastError || null
    );

  return { eventId, outboxId };
}

test("outbox worker marks due pending event as sent on successful handler", () => {
  const database = createInMemoryDb();
  const nowIso = "2026-02-24T10:00:00.000Z";
  const { outboxId } = insertOutboxEntry(database, {
    eventName: "ticket.created",
    nextAttemptAt: "2026-02-24T09:59:00.000Z"
  });
  const handled = [];

  const worker = createOutboxWorkerService({
    db: database,
    nowProvider: () => nowIso,
    processEvent: (entry) => handled.push(entry)
  });

  const summary = worker.runOnce();
  assert.equal(summary.claimed, 1);
  assert.equal(summary.succeeded, 1);
  assert.equal(summary.retried, 0);
  assert.equal(summary.dead_lettered, 0);
  assert.equal(handled.length, 1);

  const row = database.prepare("SELECT * FROM event_outbox WHERE id = ?").get(outboxId);
  assert.equal(row.status, "sent");
  assert.equal(row.attempts, 0);
  assert.ok(typeof row.processed_at === "string" && row.processed_at.length > 0);
  assert.equal(row.last_error, null);

  database.close();
});

test("outbox worker schedules retry with backoff on transient handler error", () => {
  const database = createInMemoryDb();
  const nowIso = "2026-02-24T10:00:00.000Z";
  const { outboxId } = insertOutboxEntry(database, {
    eventName: "task.synced",
    attempts: 0,
    nextAttemptAt: "2026-02-24T09:59:00.000Z"
  });

  const worker = createOutboxWorkerService({
    db: database,
    nowProvider: () => nowIso,
    retryBaseMs: 1000,
    retryMaxMs: 8000,
    maxAttempts: 3,
    processEvent: () => {
      throw new Error("temporary_delivery_failure");
    }
  });

  const summary = worker.runOnce();
  assert.equal(summary.claimed, 1);
  assert.equal(summary.succeeded, 0);
  assert.equal(summary.retried, 1);
  assert.equal(summary.dead_lettered, 0);

  const row = database.prepare("SELECT * FROM event_outbox WHERE id = ?").get(outboxId);
  assert.equal(row.status, "pending");
  assert.equal(row.attempts, 1);
  assert.equal(row.last_error, "temporary_delivery_failure");
  assert.ok(Date.parse(row.next_attempt_at) > Date.parse(nowIso));

  database.close();
});

test("outbox worker moves event to dead-letter after max attempts", () => {
  const database = createInMemoryDb();
  const nowIso = "2026-02-24T10:00:00.000Z";
  const { outboxId } = insertOutboxEntry(database, {
    eventName: "ticket.closed",
    attempts: 1,
    nextAttemptAt: "2026-02-24T09:58:00.000Z"
  });

  const worker = createOutboxWorkerService({
    db: database,
    nowProvider: () => nowIso,
    maxAttempts: 2,
    processEvent: () => {
      throw new Error("permanent_delivery_failure");
    }
  });

  const summary = worker.runOnce();
  assert.equal(summary.claimed, 1);
  assert.equal(summary.succeeded, 0);
  assert.equal(summary.retried, 0);
  assert.equal(summary.dead_lettered, 1);

  const row = database.prepare("SELECT * FROM event_outbox WHERE id = ?").get(outboxId);
  assert.equal(row.status, "failed");
  assert.equal(row.attempts, 2);
  assert.equal(row.last_error, "permanent_delivery_failure");

  database.close();
});

test("outbox worker stats expose queue and runtime observability", () => {
  const database = createInMemoryDb();
  const nowIso = "2026-02-24T10:00:00.000Z";

  insertOutboxEntry(database, {
    outboxId: "outbox-pending-due",
    status: "pending",
    nextAttemptAt: "2026-02-24T09:59:00.000Z"
  });
  insertOutboxEntry(database, {
    outboxId: "outbox-pending-future",
    status: "pending",
    nextAttemptAt: "2026-02-24T10:15:00.000Z"
  });
  insertOutboxEntry(database, {
    outboxId: "outbox-sent",
    status: "sent"
  });
  insertOutboxEntry(database, {
    outboxId: "outbox-failed",
    status: "failed"
  });
  insertOutboxEntry(database, {
    outboxId: "outbox-processing",
    status: "processing"
  });

  const worker = createOutboxWorkerService({
    db: database,
    nowProvider: () => nowIso,
    pollMs: 3000,
    batchSize: 15,
    maxAttempts: 4,
    retryBaseMs: 1200,
    retryMaxMs: 15000
  });

  const stats = worker.getStats();
  assert.equal(stats.queue.total, 5);
  assert.equal(stats.queue.pending, 2);
  assert.equal(stats.queue.processing, 1);
  assert.equal(stats.queue.sent, 1);
  assert.equal(stats.queue.failed, 1);
  assert.equal(stats.queue.due_now, 1);
  assert.equal(stats.runtime.is_running, false);
  assert.equal(stats.runtime.ticks_total, 0);
  assert.equal(stats.config.poll_ms, 3000);
  assert.equal(stats.config.batch_size, 15);
  assert.equal(stats.config.max_attempts, 4);
  assert.equal(stats.config.retry_base_ms, 1200);
  assert.equal(stats.config.retry_max_ms, 15000);

  database.close();
});
