const test = require("node:test");
const assert = require("node:assert/strict");
const { createDomainEventsService } = require("../services/domain-events");

function createDbStub(options = {}) {
  return {
    transaction(callback) {
      return (...args) => callback(...args);
    },
    prepare(sql) {
      return {
        run(...params) {
          if (typeof options.runFactory === "function") {
            return options.runFactory(sql, params);
          }
          return { changes: 1 };
        },
        all(...params) {
          if (typeof options.rowsFactory === "function") {
            return options.rowsFactory(sql, params);
          }
          return [];
        }
      };
    }
  };
}

test("domain events service publishes event and enqueues outbox entry", () => {
  const runCalls = [];
  const service = createDomainEventsService({
    db: createDbStub({
      runFactory: (sql, params) => {
        runCalls.push({ sql, params });
        return { changes: 1 };
      }
    })
  });

  const result = service.publishDomainEvent({
    eventName: "ticket.created",
    aggregateType: "ticket",
    aggregateId: "ticket-1",
    actorUserId: "dev-1",
    payload: { status: "submitted" },
    correlationId: "corr-1",
    source: "core"
  });

  assert.equal(result.event_name, "ticket.created");
  assert.equal(result.status, "pending");
  assert.equal(typeof result.event_id, "string");
  assert.equal(typeof result.outbox_id, "string");

  assert.equal(runCalls.length, 2);
  assert.match(runCalls[0].sql, /INSERT INTO domain_events/);
  assert.match(runCalls[1].sql, /INSERT INTO event_outbox/);
  assert.equal(runCalls[0].params[1], "ticket.created");
  assert.equal(runCalls[0].params[2], "ticket");
  assert.equal(runCalls[0].params[3], "ticket-1");
  assert.equal(runCalls[1].params[2], "ticket.created");
});

test("domain events service validates required publish params", () => {
  const service = createDomainEventsService({ db: createDbStub() });

  assert.throws(() => {
    service.publishDomainEvent({
      eventName: "",
      aggregateType: "ticket",
      aggregateId: "ticket-1"
    });
  }, (error) => error.code === "event_name_required" && error.status === 400);

  assert.throws(() => {
    service.publishDomainEvent({
      eventName: "ticket.created",
      aggregateType: "",
      aggregateId: ""
    });
  }, (error) => error.code === "aggregate_reference_required" && error.status === 400);
});

test("domain events service returns outbox entries with filters", () => {
  const service = createDomainEventsService({
    db: createDbStub({
      rowsFactory: (sql, params) => {
        assert.match(sql, /FROM event_outbox o/);
        assert.match(sql, /WHERE o\.status = \?/);
        assert.deepEqual(params, ["pending", 2]);
        return [{ id: "outbox-1", event_id: "event-1", status: "pending" }];
      }
    })
  });

  const result = service.getOutboxEntries({ limit: 2, status: "pending" });
  assert.equal(result.count, 1);
  assert.equal(Array.isArray(result.items), true);
  assert.equal(result.items[0].id, "outbox-1");
});

test("domain events service rejects invalid outbox status", () => {
  const service = createDomainEventsService({ db: createDbStub() });

  assert.throws(() => {
    service.getOutboxEntries({ status: "unknown-status" });
  }, (error) => error.code === "invalid_outbox_status" && error.status === 400);
});
