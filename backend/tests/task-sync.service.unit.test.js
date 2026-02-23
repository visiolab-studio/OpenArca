const test = require("node:test");
const assert = require("node:assert/strict");
const { createTaskSyncService } = require("../services/task-sync");

function createDbStub(options = {}) {
  return {
    prepare(sql) {
      return {
        get(...params) {
          if (typeof options.getFactory === "function") {
            return options.getFactory(sql, params);
          }
          return undefined;
        },
        all(...params) {
          if (typeof options.rowsFactory === "function") {
            return options.rowsFactory(sql, params);
          }
          return [];
        },
        run(...params) {
          if (typeof options.runFactory === "function") {
            return options.runFactory(sql, params);
          }
          return { changes: 1 };
        }
      };
    }
  };
}

test("task sync updates existing linked task status when desired status changed", () => {
  const runCalls = [];
  const service = createTaskSyncService({
    db: createDbStub({
      getFactory: (sql) => {
        if (sql.includes("FROM dev_tasks") && sql.includes("ticket_id = ? AND created_by = ?")) {
          return { id: "task-1", status: "todo" };
        }
        return { max_order: 0 };
      },
      runFactory: (sql, params) => {
        runCalls.push({ sql, params });
        return { changes: 1 };
      }
    })
  });

  service.ensureDevTaskForAcceptedTicket({
    ticketId: "ticket-1",
    userId: "dev-1",
    ticket: {
      status: "in_progress",
      title: "Ticket title",
      description: "Desc",
      priority: "high"
    }
  });

  assert.equal(runCalls.length, 1);
  assert.match(runCalls[0].sql, /UPDATE dev_tasks SET status = \?/);
  assert.deepEqual(runCalls[0].params, ["in_progress", "task-1"]);
});

test("task sync creates linked task when none exists and status should be active", () => {
  const runCalls = [];
  const service = createTaskSyncService({
    db: createDbStub({
      getFactory: (sql) => {
        if (sql.includes("FROM dev_tasks") && sql.includes("ticket_id = ? AND created_by = ?")) {
          return undefined;
        }
        if (sql.includes("SELECT COALESCE(MAX(order_index), -1) AS max_order")) {
          return { max_order: 4 };
        }
        return undefined;
      },
      runFactory: (sql, params) => {
        runCalls.push({ sql, params });
        return { changes: 1 };
      }
    })
  });

  service.ensureDevTaskForAcceptedTicket({
    ticketId: "ticket-1",
    userId: "dev-1",
    ticket: {
      status: "verified",
      number: 11,
      title: "Ticket title",
      description: "Some description",
      priority: "normal",
      estimated_hours: 3,
      planned_date: "2026-02-24"
    }
  });

  assert.equal(runCalls.length, 1);
  assert.match(runCalls[0].sql, /INSERT INTO dev_tasks/);
  assert.equal(runCalls[0].params[6], "todo");
  assert.equal(runCalls[0].params[7], 5);
  assert.equal(runCalls[0].params[8], "ticket-1");
  assert.equal(runCalls[0].params[9], "dev-1");
});

test("task sync normalize removes active linked tasks when assignee cleared", () => {
  const runCalls = [];
  const service = createTaskSyncService({
    db: createDbStub({
      rowsFactory: (sql) => {
        if (sql.includes("FROM dev_tasks") && sql.includes("WHERE ticket_id = ?")) {
          return [
            { id: "task-a", created_by: "dev-1" },
            { id: "task-b", created_by: "dev-2" }
          ];
        }
        return [];
      },
      runFactory: (sql, params) => {
        runCalls.push({ sql, params });
        return { changes: 2 };
      }
    })
  });

  service.normalizeLinkedDevTasksForTicket({
    ticketId: "ticket-1",
    assigneeId: null
  });

  assert.equal(runCalls.length, 1);
  assert.match(runCalls[0].sql, /DELETE FROM dev_tasks WHERE ticket_id = \?/);
  assert.deepEqual(runCalls[0].params, ["ticket-1"]);
});

test("task sync normalize transfers top active task when assignee has no linked task", () => {
  const runCalls = [];
  const service = createTaskSyncService({
    db: createDbStub({
      rowsFactory: (sql) => {
        if (sql.includes("FROM dev_tasks") && sql.includes("WHERE ticket_id = ?")) {
          return [
            { id: "task-latest", created_by: "dev-old" },
            { id: "task-other", created_by: "dev-old-2" }
          ];
        }
        return [];
      },
      getFactory: (sql, params) => {
        if (sql.includes("SELECT COALESCE(MAX(order_index), -1) AS max_order")) {
          assert.deepEqual(params, ["dev-new", "task-latest"]);
          return { max_order: 7 };
        }
        return undefined;
      },
      runFactory: (sql, params) => {
        runCalls.push({ sql, params });
        return { changes: 1 };
      }
    })
  });

  service.normalizeLinkedDevTasksForTicket({
    ticketId: "ticket-1",
    assigneeId: "dev-new"
  });

  assert.equal(runCalls.length, 2);
  assert.match(runCalls[0].sql, /UPDATE dev_tasks/);
  assert.deepEqual(runCalls[0].params, ["dev-new", 8, "task-latest"]);
  assert.match(runCalls[1].sql, /DELETE FROM dev_tasks/);
  assert.deepEqual(runCalls[1].params, ["ticket-1", "task-latest"]);
});
