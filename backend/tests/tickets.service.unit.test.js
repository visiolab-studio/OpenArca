const test = require("node:test");
const assert = require("node:assert/strict");
const { createTicketsService } = require("../services/tickets");

function createDbStub(capture) {
  return {
    prepare(sql) {
      capture.sql = sql;
      return {
        all(...params) {
          capture.params = params;
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
