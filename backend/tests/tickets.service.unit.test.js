const test = require("node:test");
const assert = require("node:assert/strict");
const { createTicketsService } = require("../services/tickets");

function createDbStub(capture, options = {}) {
  return {
    prepare(sql) {
      capture.sql = sql;
      return {
        all(...params) {
          capture.params = params;
          if (typeof options.rowsFactory === "function") {
            return options.rowsFactory(sql, params);
          }
          return [{ id: "ticket-1" }];
        }
      };
    }
  };
}

test("tickets service filters to own tickets for standard user", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({ db: createDbStub(capture) });

  const rows = service.listTickets({
    user: { id: "user-1", role: "user" },
    query: {}
  });

  assert.equal(Array.isArray(rows), true);
  assert.equal(rows.length, 1);
  assert.match(capture.sql, /WHERE t\.reporter_id = \?/);
  assert.deepEqual(capture.params, ["user-1"]);
});

test("tickets service allows developer global list unless my=1", () => {
  const captureGlobal = { sql: "", params: [] };
  const serviceGlobal = createTicketsService({ db: createDbStub(captureGlobal) });
  serviceGlobal.listTickets({
    user: { id: "dev-1", role: "developer" },
    query: {}
  });
  assert.doesNotMatch(captureGlobal.sql, /WHERE t\.reporter_id = \?/);
  assert.deepEqual(captureGlobal.params, []);

  const captureMine = { sql: "", params: [] };
  const serviceMine = createTicketsService({ db: createDbStub(captureMine) });
  serviceMine.listTickets({
    user: { id: "dev-1", role: "developer" },
    query: { my: "1" }
  });
  assert.match(captureMine.sql, /WHERE t\.reporter_id = \?/);
  assert.deepEqual(captureMine.params, ["dev-1"]);
});

test("tickets service includes query filters in params order", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({ db: createDbStub(capture) });

  service.listTickets({
    user: { id: "dev-1", role: "developer" },
    query: {
      status: "verified",
      priority: "high",
      category: "bug",
      project_id: "project-1"
    }
  });

  assert.match(capture.sql, /WHERE t\.status = \? AND t\.priority = \? AND t\.category = \? AND t\.project_id = \?/);
  assert.deepEqual(capture.params, ["verified", "high", "bug", "project-1"]);
});

test("tickets service validates user context", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({ db: createDbStub(capture) });

  assert.throws(() => {
    service.listTickets({
      user: { id: "", role: "" },
      query: {}
    });
  }, /invalid_user_context/);
});

test("tickets service returns grouped workload with stats and queue mapping", () => {
  const capture = { sql: "", params: [] };
  const rows = [
    { id: "t-1", status: "in_progress", reporter_id: "user-1" },
    { id: "t-2", status: "verified", reporter_id: "user-2" },
    { id: "t-3", status: "waiting", reporter_id: "user-2" },
    { id: "t-4", status: "blocked", reporter_id: "user-3" },
    { id: "t-5", status: "submitted", reporter_id: "user-1" }
  ];
  const service = createTicketsService({
    db: createDbStub(capture, { rowsFactory: () => rows })
  });

  const payload = service.getWorkload({
    user: { id: "dev-1", role: "developer" }
  });

  assert.match(capture.sql, /FROM tickets t/);
  assert.equal(payload.in_progress.length, 1);
  assert.equal(payload.queue.length, 2);
  assert.equal(payload.blocked.length, 1);
  assert.equal(payload.submitted.length, 1);
  assert.deepEqual(payload._stats, {
    in_progress: 1,
    queue: 2,
    blocked: 1,
    submitted: 1,
    open: 5
  });
});

test("tickets service sets can_open by role and ownership in workload payload", () => {
  const capture = { sql: "", params: [] };
  const rows = [
    { id: "t-1", status: "verified", reporter_id: "user-1" },
    { id: "t-2", status: "verified", reporter_id: "user-2" }
  ];
  const service = createTicketsService({
    db: createDbStub(capture, { rowsFactory: () => rows })
  });

  const payloadForUser = service.getWorkload({
    user: { id: "user-1", role: "user" }
  });
  assert.equal(payloadForUser.queue[0].can_open, true);
  assert.equal(payloadForUser.queue[1].can_open, false);

  const payloadForDeveloper = service.getWorkload({
    user: { id: "dev-1", role: "developer" }
  });
  assert.equal(payloadForDeveloper.queue[0].can_open, true);
  assert.equal(payloadForDeveloper.queue[1].can_open, true);
});
