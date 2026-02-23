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
        },
        get(...params) {
          capture.params = params;
          if (typeof options.getFactory === "function") {
            return options.getFactory(sql, params);
          }
          return { count: 0 };
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

test("tickets service returns overview stats from grouped counts and closed_today query", () => {
  const capture = { sql: "", params: [] };
  const groupedRows = [
    { status: "in_progress", count: 2 },
    { status: "verified", count: 3 },
    { status: "submitted", count: 1 },
    { status: "blocked", count: 4 },
    { status: "waiting", count: 5 }
  ];
  const service = createTicketsService({
    db: createDbStub(capture, {
      rowsFactory: (sql) => {
        if (sql.includes("GROUP BY status")) {
          return groupedRows;
        }
        return [];
      },
      getFactory: (sql) => {
        if (sql.includes("date(closed_at) = date('now')")) {
          return { count: 7 };
        }
        return { count: 0 };
      }
    })
  });

  const payload = service.getOverviewStats();

  assert.deepEqual(payload, {
    in_progress: 2,
    waiting: 5,
    submitted: 1,
    verified: 3,
    blocked: 4,
    closed_today: 7
  });
});

test("tickets service overview stats fallback to zeros when rows are missing", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      rowsFactory: () => [],
      getFactory: () => ({ count: 0 })
    })
  });

  const payload = service.getOverviewStats();

  assert.deepEqual(payload, {
    in_progress: 0,
    waiting: 0,
    submitted: 0,
    verified: 0,
    blocked: 0,
    closed_today: 0
  });
});

test("tickets service computes activation stats deterministically", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      rowsFactory: (sql) => {
        if (sql.includes("FROM users") && sql.includes("role = 'user'")) {
          return [{ id: "user-1", created_at: "2026-01-01 10:00:00" }];
        }
        if (sql.includes("FROM tickets")) {
          return [{ id: "ticket-1", reporter_id: "user-1", created_at: "2026-01-01 10:15:00" }];
        }
        if (sql.includes("FROM ticket_history") && sql.includes("field = 'assignee_id'")) {
          return [{ ticket_id: "ticket-1", created_at: "2026-01-01 10:40:00", new_value: "dev-1" }];
        }
        return [];
      }
    })
  });

  const payload = service.getActivationStats();

  assert.equal(typeof payload.generated_at, "string");
  assert.equal(payload.users_total, 1);
  assert.equal(payload.users_with_first_ticket, 1);
  assert.equal(payload.users_with_first_dev_assignment, 1);
  assert.deepEqual(payload.time_to_first_ticket_minutes, {
    avg_minutes: 15,
    median_minutes: 15,
    sample_size: 1
  });
  assert.deepEqual(payload.time_to_first_dev_assignment_minutes, {
    avg_minutes: 25,
    median_minutes: 25,
    sample_size: 1
  });
  assert.deepEqual(payload.first_dev_assignment_under_30m, {
    within_target_count: 1,
    within_target_percent: 100,
    sample_size: 1
  });
});

test("tickets service activation stats returns null metrics when samples are missing", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      rowsFactory: (sql) => {
        if (sql.includes("FROM users") && sql.includes("role = 'user'")) {
          return [{ id: "user-1", created_at: "2026-01-01 10:00:00" }];
        }
        return [];
      }
    })
  });

  const payload = service.getActivationStats();

  assert.equal(payload.users_total, 1);
  assert.equal(payload.users_with_first_ticket, 0);
  assert.equal(payload.users_with_first_dev_assignment, 0);
  assert.deepEqual(payload.time_to_first_ticket_minutes, {
    avg_minutes: null,
    median_minutes: null,
    sample_size: 0
  });
  assert.deepEqual(payload.time_to_first_dev_assignment_minutes, {
    avg_minutes: null,
    median_minutes: null,
    sample_size: 0
  });
  assert.deepEqual(payload.first_dev_assignment_under_30m, {
    within_target_count: 0,
    within_target_percent: null,
    sample_size: 0
  });
});
