const test = require("node:test");
const assert = require("node:assert/strict");
const { createTicketsService } = require("../services/tickets");
const { TICKET_STATUSES } = require("../constants");

function createDbStub(capture, options = {}) {
  return {
    transaction(callback) {
      if (typeof options.transactionFactory === "function") {
        return options.transactionFactory(callback);
      }
      return (...args) => callback(...args);
    },
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
        },
        run(...params) {
          capture.params = params;
          if (typeof options.runFactory === "function") {
            return options.runFactory(sql, params);
          }
          return { changes: 1 };
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

test("tickets service returns ticket by id", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        assert.match(sql, /SELECT \* FROM tickets WHERE id = \?/);
        assert.deepEqual(params, ["ticket-1"]);
        return { id: "ticket-1", title: "Sample ticket" };
      }
    })
  });

  const ticket = service.getTicketById({ ticketId: "ticket-1" });
  assert.deepEqual(ticket, { id: "ticket-1", title: "Sample ticket" });
});

test("tickets service creates ticket with attachments and returns telemetry metadata", () => {
  const capture = { sql: "", params: [] };
  const runCalls = [];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT 1 FROM projects WHERE id = ?")) {
          assert.deepEqual(params, ["project-1"]);
          return { 1: 1 };
        }
        if (sql.includes("SELECT value FROM settings WHERE key = 'ticket_counter'")) {
          return { value: "7" };
        }
        return { count: 0 };
      },
      runFactory: (sql, params) => {
        runCalls.push({ sql, params });
        return { changes: 1 };
      }
    })
  });

  const result = service.createTicket({
    user: { id: "user-1", role: "user" },
    payload: {
      title: "Ticket title long enough",
      description: "A".repeat(120),
      steps_to_reproduce: "Step list",
      expected_result: "Expected",
      actual_result: "Actual",
      environment: "Prod",
      urgency_reporter: "high",
      category: "bug",
      project_id: "project-1"
    },
    files: [
      {
        filename: "att-1",
        originalname: "a.txt",
        mimetype: "text/plain",
        size: 10
      },
      {
        filename: "att-2",
        originalname: "b.txt",
        mimetype: "text/plain",
        size: 20
      }
    ]
  });

  assert.equal(result.shouldTrackTicketCreated, true);
  assert.equal(result.telemetry.status, "submitted");
  assert.equal(result.telemetry.category, "bug");
  assert.equal(typeof result.ticketId, "string");
  assert.ok(result.ticketId.length > 10);

  const updateCounterCall = runCalls.find((entry) =>
    entry.sql.includes("UPDATE settings SET value = ? WHERE key = 'ticket_counter'")
  );
  assert.ok(updateCounterCall);
  assert.deepEqual(updateCounterCall.params, ["8"]);

  const ticketInsertCall = runCalls.find((entry) =>
    entry.sql.includes("INSERT INTO tickets")
  );
  assert.ok(ticketInsertCall);
  assert.equal(ticketInsertCall.params[1], 8);
  assert.equal(ticketInsertCall.params[10], "project-1");
  assert.equal(ticketInsertCall.params[11], "user-1");

  const attachmentInsertCalls = runCalls.filter((entry) =>
    entry.sql.includes("INSERT INTO attachments")
  );
  assert.equal(attachmentInsertCalls.length, 2);
  assert.equal(attachmentInsertCalls[0].params[6], "user-1");
  assert.equal(attachmentInsertCalls[1].params[6], "user-1");
});

test("tickets service appends ticket.created domain event to outbox contract", () => {
  const capture = { sql: "", params: [] };
  const dbStub = createDbStub(capture, {
    getFactory: (sql) => {
      if (sql.includes("SELECT value FROM settings WHERE key = 'ticket_counter'")) {
        return { value: "12" };
      }
      return undefined;
    },
    runFactory: () => ({ changes: 1 })
  });
  const appendedEvents = [];
  const service = createTicketsService({
    db: dbStub,
    appendDomainEventToOutbox: (input) => {
      appendedEvents.push(input);
      return { event_id: "event-1", outbox_id: "outbox-1", status: "pending" };
    }
  });

  const result = service.createTicket({
    user: { id: "user-1", role: "user" },
    payload: {
      title: "Ticket title long enough",
      description: "A".repeat(120),
      urgency_reporter: "high",
      category: "bug"
    },
    files: []
  });

  assert.equal(result.shouldTrackTicketCreated, true);
  assert.equal(appendedEvents.length, 1);
  assert.equal(appendedEvents[0].database, dbStub);
  assert.equal(appendedEvents[0].eventName, "ticket.created");
  assert.equal(appendedEvents[0].aggregateType, "ticket");
  assert.equal(typeof appendedEvents[0].aggregateId, "string");
  assert.ok(appendedEvents[0].aggregateId.length > 10);
  assert.equal(appendedEvents[0].actorUserId, "user-1");
  assert.deepEqual(appendedEvents[0].payload, {
    status: "submitted",
    category: "bug",
    urgency_reporter: "high"
  });
  assert.equal(appendedEvents[0].source, "core");
});

test("tickets service create ticket propagates append-domain-event errors", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT value FROM settings WHERE key = 'ticket_counter'")) {
          return { value: "3" };
        }
        return undefined;
      },
      runFactory: () => ({ changes: 1 })
    }),
    appendDomainEventToOutbox: () => {
      const error = new Error("domain_event_failed");
      error.code = "domain_event_failed";
      throw error;
    }
  });

  assert.throws(() => {
    service.createTicket({
      user: { id: "user-1", role: "user" },
      payload: {
        title: "Ticket title long enough",
        description: "A".repeat(120),
        urgency_reporter: "normal",
        category: "other"
      },
      files: []
    });
  }, (error) => error.code === "domain_event_failed");
});

test("tickets service create ticket validates project reference", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT 1 FROM projects WHERE id = ?")) {
          return undefined;
        }
        return { value: "0" };
      }
    })
  });

  assert.throws(() => {
    service.createTicket({
      user: { id: "user-1", role: "user" },
      payload: {
        title: "Ticket title long enough",
        description: "A".repeat(120),
        urgency_reporter: "normal",
        category: "other",
        project_id: "missing-project-id"
      },
      files: []
    });
  }, (error) => error.code === "project_not_found" && error.status === 400);
});

test("tickets service update ticket blocks non-developer when ticket is locked", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "user-1", status: "verified" };
        }
        return undefined;
      }
    })
  });

  assert.throws(() => {
    service.updateTicket({
      ticketId: "ticket-1",
      user: { id: "user-1", role: "user" },
      rawPayload: { title: "Updated title with enough length" }
    });
  }, (error) => error.code === "ticket_locked" && error.status === 403);
});

test("tickets service update ticket validates patch payload and exposes details", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "dev-1", status: "submitted" };
        }
        return undefined;
      }
    })
  });

  assert.throws(() => {
    service.updateTicket({
      ticketId: "ticket-1",
      user: { id: "dev-1", role: "developer" },
      rawPayload: {}
    });
  }, (error) => {
    return (
      error.code === "validation_error" &&
      error.status === 400 &&
      Array.isArray(error.details) &&
      error.details.length > 0
    );
  });
});

test("tickets service update ticket requires closure summary before closing", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "user-1", status: "verified" };
        }
        if (sql.includes("FROM comments")) {
          return undefined;
        }
        return undefined;
      }
    })
  });

  assert.throws(() => {
    service.updateTicket({
      ticketId: "ticket-1",
      user: { id: "dev-1", role: "developer" },
      rawPayload: { status: "closed" }
    });
  }, (error) => error.code === "closure_summary_required" && error.status === 400);
});

test("tickets service update ticket auto-verifies planning and returns side-effects metadata", () => {
  const capture = { sql: "", params: [] };
  const runCalls = [];
  const syncCalls = [];
  let ticketReadCount = 0;

  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          ticketReadCount += 1;
          if (ticketReadCount === 1) {
            return {
              id: "ticket-1",
              reporter_id: "user-1",
              status: "submitted",
              assignee_id: null,
              title: "Ticket title",
              description: "D".repeat(120),
              priority: "normal",
              planned_date: null,
              estimated_hours: null
            };
          }

          return {
            id: "ticket-1",
            reporter_id: "user-1",
            status: "verified",
            assignee_id: "dev-1",
            title: "Ticket title",
            description: "D".repeat(120)
          };
        }
        return undefined;
      },
      runFactory: (sql, params) => {
        runCalls.push({ sql, params });
        return { changes: 1 };
      }
    }),
    taskSyncService: {
      normalizeLinkedDevTasksForTicket(payload) {
        syncCalls.push({ type: "normalize", payload });
      },
      ensureDevTaskForAcceptedTicket(payload) {
        syncCalls.push({ type: "ensure", payload });
      }
    }
  });

  const result = service.updateTicket({
    ticketId: "ticket-1",
    user: { id: "dev-1", role: "developer" },
    rawPayload: { planned_date: "2026-03-01" }
  });

  assert.equal(result.oldStatus, "submitted");
  assert.equal(result.newStatus, "verified");
  assert.equal(result.shouldTrackTicketClosed, false);
  assert.equal(result.shouldTrackBoardDrag, false);
  assert.equal(result.shouldNotifyStatusChange, true);
  assert.equal(result.ticket.status, "verified");
  assert.equal(result.ticket.assignee_id, "dev-1");

  const updateCall = runCalls.find((entry) => entry.sql.includes("UPDATE tickets SET"));
  assert.ok(updateCall);
  assert.ok(updateCall.params.includes("verified"));
  assert.ok(updateCall.params.includes("dev-1"));

  const historyCalls = runCalls.filter((entry) => entry.sql.includes("INSERT INTO ticket_history"));
  assert.ok(historyCalls.length >= 1);

  assert.equal(syncCalls.length, 2);
  assert.deepEqual(syncCalls[0], {
    type: "normalize",
    payload: {
      ticketId: "ticket-1",
      assigneeId: "dev-1"
    }
  });
  assert.equal(syncCalls[1].type, "ensure");
  assert.equal(syncCalls[1].payload.ticketId, "ticket-1");
  assert.equal(syncCalls[1].payload.userId, "dev-1");
  assert.equal(syncCalls[1].payload.ticket.status, "verified");
});

test("tickets service update ticket marks board drag metadata for non-submitted status move", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return {
            id: "ticket-1",
            reporter_id: "user-1",
            status: "verified",
            assignee_id: null,
            title: "Ticket title",
            description: "D".repeat(120),
            priority: "normal"
          };
        }
        return undefined;
      },
      runFactory: () => ({ changes: 1 })
    }),
    taskSyncService: {
      normalizeLinkedDevTasksForTicket() {},
      ensureDevTaskForAcceptedTicket() {}
    }
  });

  const result = service.updateTicket({
    ticketId: "ticket-1",
    user: { id: "dev-1", role: "developer" },
    rawPayload: { status: "in_progress" }
  });

  assert.equal(result.shouldTrackBoardDrag, true);
  assert.equal(result.oldStatus, "verified");
  assert.equal(result.newStatus, "in_progress");
});

test("tickets service returns related tickets for developer without reporter filter", () => {
  const capture = { sql: "", params: [] };
  const rows = [{ id: "related-1", reporter_id: "user-2" }];
  const service = createTicketsService({
    db: createDbStub(capture, {
      rowsFactory: (sql, params) => {
        assert.match(sql, /FROM ticket_relations tr/);
        assert.doesNotMatch(sql, /AND t\.reporter_id = \?/);
        assert.deepEqual(params, ["ticket-1", "ticket-1", "ticket-1"]);
        return rows;
      }
    })
  });

  const result = service.getRelatedTickets({
    ticketId: "ticket-1",
    user: { id: "dev-1", role: "developer" }
  });

  assert.deepEqual(result, rows);
});

test("tickets service returns related tickets for user with reporter filter", () => {
  const capture = { sql: "", params: [] };
  const rows = [{ id: "related-1", reporter_id: "user-1" }];
  const service = createTicketsService({
    db: createDbStub(capture, {
      rowsFactory: (sql, params) => {
        assert.match(sql, /FROM ticket_relations tr/);
        assert.match(sql, /AND t\.reporter_id = \?/);
        assert.deepEqual(params, ["ticket-1", "ticket-1", "ticket-1", "user-1"]);
        return rows;
      }
    })
  });

  const result = service.getRelatedTickets({
    ticketId: "ticket-1",
    user: { id: "user-1", role: "user" }
  });

  assert.deepEqual(result, rows);
});

test("tickets service returns related list for developer with access check", () => {
  const capture = { sql: "", params: [] };
  const rows = [{ id: "related-1", reporter_id: "user-2" }];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          assert.deepEqual(params, ["ticket-1"]);
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      },
      rowsFactory: (sql, params) => {
        if (sql.includes("FROM ticket_relations tr")) {
          assert.deepEqual(params, ["ticket-1", "ticket-1", "ticket-1"]);
          return rows;
        }
        return [];
      }
    })
  });

  const result = service.getTicketRelatedList({
    ticketId: "ticket-1",
    user: { id: "dev-1", role: "developer" }
  });

  assert.deepEqual(result, rows);
});

test("tickets service returns related list for owner user", () => {
  const capture = { sql: "", params: [] };
  const rows = [{ id: "related-1", reporter_id: "user-1" }];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          assert.deepEqual(params, ["ticket-1"]);
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      },
      rowsFactory: (sql, params) => {
        if (sql.includes("FROM ticket_relations tr")) {
          assert.deepEqual(params, ["ticket-1", "ticket-1", "ticket-1", "user-1"]);
          return rows;
        }
        return [];
      }
    })
  });

  const result = service.getTicketRelatedList({
    ticketId: "ticket-1",
    user: { id: "user-1", role: "user" }
  });

  assert.deepEqual(result, rows);
});

test("tickets service related list throws ticket_not_found when source is missing", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return undefined;
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.getTicketRelatedList({
      ticketId: "missing-ticket",
      user: { id: "dev-1", role: "developer" }
    });
  }, (error) => error.code === "ticket_not_found" && error.status === 404);
});

test("tickets service related list throws forbidden for non-owner user", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "owner-1" };
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.getTicketRelatedList({
      ticketId: "ticket-1",
      user: { id: "user-1", role: "user" }
    });
  }, (error) => error.code === "forbidden" && error.status === 403);
});

test("tickets service creates ticket relation and returns refreshed related list", () => {
  const capture = { sql: "", params: [] };
  const insertedPairs = [];
  const relatedRows = [{ id: "ticket-related", number: 2 }];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          if (params[0] === "ticket-source") {
            return { id: "ticket-source", reporter_id: "user-1" };
          }
          return undefined;
        }
        if (sql.includes("SELECT id, number FROM tickets WHERE id = ?")) {
          if (params[0] === "ticket-related") {
            return { id: "ticket-related", number: 2 };
          }
          return undefined;
        }
        if (sql.includes("SELECT id FROM ticket_relations")) {
          return undefined;
        }
        return { count: 0 };
      },
      rowsFactory: (sql) => {
        if (sql.includes("FROM ticket_relations tr")) {
          return relatedRows;
        }
        return [];
      },
      runFactory: (sql, params) => {
        if (sql.includes("INSERT INTO ticket_relations")) {
          insertedPairs.push(params);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    })
  });

  const result = service.createTicketRelation({
    ticketId: "ticket-source",
    user: { id: "dev-1", role: "developer" },
    payload: { related_ticket_id: "ticket-related" }
  });

  assert.equal(result.created, true);
  assert.deepEqual(result.items, relatedRows);
  assert.equal(insertedPairs.length, 1);
  assert.equal(insertedPairs[0][1], "ticket-related");
  assert.equal(insertedPairs[0][2], "ticket-source");
  assert.equal(insertedPairs[0][3], "dev-1");
});

test("tickets service create relation returns existing list when relation already exists", () => {
  const capture = { sql: "", params: [] };
  const insertCalls = [];
  const relatedRows = [{ id: "ticket-related", number: 2 }];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-source", reporter_id: "user-1" };
        }
        if (sql.includes("SELECT id, number FROM tickets WHERE number = ?")) {
          assert.deepEqual(params, [2]);
          return { id: "ticket-related", number: 2 };
        }
        if (sql.includes("SELECT id FROM ticket_relations")) {
          return { id: "existing-relation" };
        }
        return { count: 0 };
      },
      rowsFactory: (sql) => {
        if (sql.includes("FROM ticket_relations tr")) {
          return relatedRows;
        }
        return [];
      },
      runFactory: (sql) => {
        if (sql.includes("INSERT INTO ticket_relations")) {
          insertCalls.push(1);
        }
        return { changes: 1 };
      }
    })
  });

  const result = service.createTicketRelation({
    ticketId: "ticket-source",
    user: { id: "dev-1", role: "developer" },
    payload: { related_ticket_number: 2 }
  });

  assert.equal(result.created, false);
  assert.deepEqual(result.items, relatedRows);
  assert.equal(insertCalls.length, 0);
});

test("tickets service create relation throws ticket_not_found for missing source", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return undefined;
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketRelation({
      ticketId: "missing-source",
      user: { id: "dev-1", role: "developer" },
      payload: { related_ticket_id: "ticket-related" }
    });
  }, (error) => error.code === "ticket_not_found" && error.status === 404);
});

test("tickets service create relation throws related_ticket_not_found", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-source", reporter_id: "user-1" };
        }
        if (sql.includes("SELECT id, number FROM tickets WHERE id = ?")) {
          return undefined;
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketRelation({
      ticketId: "ticket-source",
      user: { id: "dev-1", role: "developer" },
      payload: { related_ticket_id: "missing-target" }
    });
  }, (error) => error.code === "related_ticket_not_found" && error.status === 404);
});

test("tickets service create relation throws ticket_relation_self_ref", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-source", reporter_id: "user-1" };
        }
        if (sql.includes("SELECT id, number FROM tickets WHERE id = ?")) {
          return { id: "ticket-source", number: 1 };
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketRelation({
      ticketId: "ticket-source",
      user: { id: "dev-1", role: "developer" },
      payload: { related_ticket_id: "ticket-source" }
    });
  }, (error) => error.code === "ticket_relation_self_ref" && error.status === 400);
});

test("tickets service create relation throws forbidden for non-developer", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture)
  });

  assert.throws(() => {
    service.createTicketRelation({
      ticketId: "ticket-source",
      user: { id: "user-1", role: "user" },
      payload: { related_ticket_id: "ticket-related" }
    });
  }, (error) => error.code === "forbidden" && error.status === 403);
});

test("tickets service deletes ticket relation for developer", () => {
  const capture = { sql: "", params: [] };
  const deleteCalls = [];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          if (params[0] === "ticket-source") {
            return { id: "ticket-source", reporter_id: "user-1" };
          }
          if (params[0] === "ticket-related") {
            return { id: "ticket-related", reporter_id: "user-1" };
          }
        }
        return { count: 0 };
      },
      runFactory: (sql, params) => {
        if (sql.includes("DELETE FROM ticket_relations")) {
          deleteCalls.push(params);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    })
  });

  service.deleteTicketRelation({
    ticketId: "ticket-source",
    relatedTicketId: "ticket-related",
    user: { id: "dev-1", role: "developer" }
  });

  assert.equal(deleteCalls.length, 1);
  assert.deepEqual(deleteCalls[0], ["ticket-related", "ticket-source"]);
});

test("tickets service delete relation throws ticket_not_found", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?") && params[0] === "missing-source") {
          return undefined;
        }
        return { id: "ticket-related", reporter_id: "user-1" };
      }
    })
  });

  assert.throws(() => {
    service.deleteTicketRelation({
      ticketId: "missing-source",
      relatedTicketId: "ticket-related",
      user: { id: "dev-1", role: "developer" }
    });
  }, (error) => error.code === "ticket_not_found" && error.status === 404);
});

test("tickets service delete relation throws related_ticket_not_found", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          if (params[0] === "ticket-source") {
            return { id: "ticket-source", reporter_id: "user-1" };
          }
          if (params[0] === "missing-related") {
            return undefined;
          }
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.deleteTicketRelation({
      ticketId: "ticket-source",
      relatedTicketId: "missing-related",
      user: { id: "dev-1", role: "developer" }
    });
  }, (error) => error.code === "related_ticket_not_found" && error.status === 404);
});

test("tickets service delete relation throws ticket_relation_not_found", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-source", reporter_id: "user-1" };
        }
        return { count: 0 };
      },
      runFactory: (sql) => {
        if (sql.includes("DELETE FROM ticket_relations")) {
          return { changes: 0 };
        }
        return { changes: 0 };
      }
    })
  });

  assert.throws(() => {
    service.deleteTicketRelation({
      ticketId: "ticket-source",
      relatedTicketId: "ticket-related",
      user: { id: "dev-1", role: "developer" }
    });
  }, (error) => error.code === "ticket_relation_not_found" && error.status === 404);
});

test("tickets service delete relation throws forbidden for non-developer", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture)
  });

  assert.throws(() => {
    service.deleteTicketRelation({
      ticketId: "ticket-source",
      relatedTicketId: "ticket-related",
      user: { id: "user-1", role: "user" }
    });
  }, (error) => error.code === "forbidden" && error.status === 403);
});

test("tickets service creates ticket attachments and returns created records", () => {
  const capture = { sql: "", params: [] };
  const inserted = [];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          assert.deepEqual(params, ["ticket-1"]);
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        if (sql.includes("SELECT * FROM attachments WHERE id = ?")) {
          return { id: params[0], ticket_id: "ticket-1" };
        }
        return { count: 0 };
      },
      runFactory: (sql, params) => {
        if (sql.includes("INSERT INTO attachments")) {
          inserted.push(params);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    })
  });

  const files = [
    {
      filename: "a.txt",
      originalname: "a.txt",
      mimetype: "text/plain",
      size: 5
    },
    {
      filename: "b.txt",
      originalname: "b.txt",
      mimetype: "text/plain",
      size: 7
    }
  ];

  const result = service.createTicketAttachments({
    ticketId: "ticket-1",
    user: { id: "user-1", role: "user" },
    files,
    maxUploadBytesTotal: 20
  });

  assert.equal(Array.isArray(result), true);
  assert.equal(result.length, 2);
  assert.equal(inserted.length, 2);
  assert.equal(inserted[0][1], "ticket-1");
  assert.equal(inserted[0][2], "a.txt");
  assert.equal(inserted[0][6], "user-1");
});

test("tickets service create attachments throws attachments_required for empty files", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketAttachments({
      ticketId: "ticket-1",
      user: { id: "user-1", role: "user" },
      files: [],
      maxUploadBytesTotal: 20
    });
  }, (error) => error.code === "attachments_required" && error.status === 400);
});

test("tickets service create attachments throws attachments_too_large", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketAttachments({
      ticketId: "ticket-1",
      user: { id: "user-1", role: "user" },
      files: [{ size: 21 }],
      maxUploadBytesTotal: 20
    });
  }, (error) => error.code === "attachments_too_large" && error.status === 400);
});

test("tickets service create attachments throws ticket_not_found", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return undefined;
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketAttachments({
      ticketId: "missing-ticket",
      user: { id: "dev-1", role: "developer" },
      files: [{ size: 5 }],
      maxUploadBytesTotal: 20
    });
  }, (error) => error.code === "ticket_not_found" && error.status === 404);
});

test("tickets service create attachments throws forbidden for non-owner user", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "owner-1" };
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketAttachments({
      ticketId: "ticket-1",
      user: { id: "user-1", role: "user" },
      files: [{ size: 5 }],
      maxUploadBytesTotal: 20
    });
  }, (error) => error.code === "forbidden" && error.status === 403);
});

test("tickets service creates comment and returns side-effects metadata", () => {
  const capture = { sql: "", params: [] };
  const runCalls = [];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        if (sql.includes("SELECT * FROM comments WHERE id = ?")) {
          return { id: params[0], ticket_id: "ticket-1", content: "Done" };
        }
        return { count: 0 };
      },
      runFactory: (sql, params) => {
        if (sql.includes("INSERT INTO comments")) {
          runCalls.push(params);
        }
        return { changes: 1 };
      }
    })
  });

  const result = service.createTicketComment({
    ticketId: "ticket-1",
    user: { id: "dev-1", role: "developer" },
    payload: {
      content: "Done",
      is_internal: false,
      is_closure_summary: true,
      type: "comment"
    }
  });

  assert.equal(runCalls.length, 1);
  assert.equal(runCalls[0][1], "ticket-1");
  assert.equal(runCalls[0][2], "dev-1");
  assert.equal(result.comment.ticket_id, "ticket-1");
  assert.equal(result.shouldNotifyReporterDeveloperComment, true);
  assert.equal(result.shouldTrackClosureSummary, true);
});

test("tickets service create comment blocks internal for non-developer", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketComment({
      ticketId: "ticket-1",
      user: { id: "user-1", role: "user" },
      payload: { content: "x", is_internal: true, is_closure_summary: false, type: "comment" }
    });
  }, (error) => error.code === "forbidden" && error.status === 403);
});

test("tickets service create comment blocks closure summary for non-developer", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketComment({
      ticketId: "ticket-1",
      user: { id: "user-1", role: "user" },
      payload: { content: "x", is_internal: false, is_closure_summary: true, type: "comment" }
    });
  }, (error) => error.code === "forbidden" && error.status === 403);
});

test("tickets service create comment validates closure summary visibility", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketComment({
      ticketId: "ticket-1",
      user: { id: "dev-1", role: "developer" },
      payload: { content: "x", is_internal: true, is_closure_summary: true, type: "comment" }
    });
  }, (error) => error.code === "invalid_closure_summary_visibility" && error.status === 400);
});

test("tickets service create comment validates parent comment id", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        if (sql.includes("SELECT id FROM comments WHERE id = ? AND ticket_id = ?")) {
          return undefined;
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketComment({
      ticketId: "ticket-1",
      user: { id: "dev-1", role: "developer" },
      payload: {
        content: "x",
        is_internal: false,
        is_closure_summary: false,
        type: "comment",
        parent_id: "comment-parent-id"
      }
    });
  }, (error) => error.code === "invalid_parent_comment" && error.status === 400);
});

test("tickets service create comment throws ticket_not_found", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return undefined;
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketComment({
      ticketId: "missing-ticket",
      user: { id: "dev-1", role: "developer" },
      payload: { content: "x", is_internal: false, is_closure_summary: false, type: "comment" }
    });
  }, (error) => error.code === "ticket_not_found" && error.status === 404);
});

test("tickets service returns external references ordered by created_at desc", () => {
  const capture = { sql: "", params: [] };
  const rows = [
    { id: "ref-2", ref_type: "deployment", url: "https://example.com/deploy/2" },
    { id: "ref-1", ref_type: "git_pr", url: "https://example.com/pr/1" }
  ];
  const service = createTicketsService({
    db: createDbStub(capture, {
      rowsFactory: (sql, params) => {
        assert.match(sql, /FROM ticket_external_references r/);
        assert.match(sql, /ORDER BY datetime\(r\.created_at\) DESC/);
        assert.deepEqual(params, ["ticket-1"]);
        return rows;
      }
    })
  });

  const result = service.getExternalReferences({ ticketId: "ticket-1" });
  assert.deepEqual(result, rows);
});

test("tickets service returns ticket external references for developer", () => {
  const capture = { sql: "", params: [] };
  const rows = [{ id: "ref-1" }];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          assert.deepEqual(params, ["ticket-1"]);
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      },
      rowsFactory: (sql, params) => {
        if (sql.includes("FROM ticket_external_references r")) {
          assert.deepEqual(params, ["ticket-1"]);
          return rows;
        }
        return [];
      }
    })
  });

  const result = service.getTicketExternalReferences({
    ticketId: "ticket-1",
    user: { id: "dev-1", role: "developer" }
  });

  assert.deepEqual(result, rows);
});

test("tickets service creates external reference for developer and returns refreshed list", () => {
  const capture = { sql: "", params: [] };
  const rows = [{ id: "ref-created", url: "https://example.com/task/123" }];
  const runCalls = [];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          assert.deepEqual(params, ["ticket-1"]);
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      },
      rowsFactory: (sql) => {
        if (sql.includes("FROM ticket_external_references r")) {
          return rows;
        }
        return [];
      },
      runFactory: (sql, params) => {
        if (sql.includes("INSERT INTO ticket_external_references")) {
          runCalls.push(params);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    })
  });

  const result = service.createTicketExternalReference({
    ticketId: "ticket-1",
    user: { id: "dev-1", role: "developer" },
    payload: {
      ref_type: "task",
      url: " https://example.com/task/123 ",
      title: "  Sprint board item  "
    }
  });

  assert.equal(runCalls.length, 1);
  assert.equal(runCalls[0][1], "ticket-1");
  assert.equal(runCalls[0][2], "task");
  assert.equal(runCalls[0][3], "https://example.com/task/123");
  assert.equal(runCalls[0][4], "Sprint board item");
  assert.equal(runCalls[0][5], "dev-1");
  assert.deepEqual(result, rows);
});

test("tickets service returns ticket external references for ticket owner", () => {
  const capture = { sql: "", params: [] };
  const rows = [{ id: "ref-1" }];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      },
      rowsFactory: (sql) => {
        if (sql.includes("FROM ticket_external_references r")) {
          return rows;
        }
        return [];
      }
    })
  });

  const result = service.getTicketExternalReferences({
    ticketId: "ticket-1",
    user: { id: "user-1", role: "user" }
  });

  assert.deepEqual(result, rows);
});

test("tickets service create external reference throws ticket_not_found", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return undefined;
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.createTicketExternalReference({
      ticketId: "missing-ticket",
      user: { id: "dev-1", role: "developer" },
      payload: {
        ref_type: "task",
        url: "https://example.com/task/123"
      }
    });
  }, (error) => error.code === "ticket_not_found" && error.status === 404);
});

test("tickets service create external reference throws forbidden for non-developer", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture)
  });

  assert.throws(() => {
    service.createTicketExternalReference({
      ticketId: "ticket-1",
      user: { id: "user-1", role: "user" },
      payload: {
        ref_type: "task",
        url: "https://example.com/task/123"
      }
    });
  }, (error) => error.code === "forbidden" && error.status === 403);
});

test("tickets service deletes external reference for developer", () => {
  const capture = { sql: "", params: [] };
  const runCalls = [];
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          assert.deepEqual(params, ["ticket-1"]);
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      },
      runFactory: (sql, params) => {
        if (sql.includes("DELETE FROM ticket_external_references")) {
          runCalls.push(params);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    })
  });

  service.deleteTicketExternalReference({
    ticketId: "ticket-1",
    refId: "ref-1",
    user: { id: "dev-1", role: "developer" }
  });

  assert.equal(runCalls.length, 1);
  assert.deepEqual(runCalls[0], ["ref-1", "ticket-1"]);
});

test("tickets service delete external reference throws ticket_not_found", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return undefined;
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.deleteTicketExternalReference({
      ticketId: "missing-ticket",
      refId: "ref-1",
      user: { id: "dev-1", role: "developer" }
    });
  }, (error) => error.code === "ticket_not_found" && error.status === 404);
});

test("tickets service delete external reference throws forbidden for non-developer", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture)
  });

  assert.throws(() => {
    service.deleteTicketExternalReference({
      ticketId: "ticket-1",
      refId: "ref-1",
      user: { id: "user-1", role: "user" }
    });
  }, (error) => error.code === "forbidden" && error.status === 403);
});

test("tickets service delete external reference throws external_reference_not_found", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "user-1" };
        }
        return { count: 0 };
      },
      runFactory: (sql) => {
        if (sql.includes("DELETE FROM ticket_external_references")) {
          return { changes: 0 };
        }
        return { changes: 0 };
      }
    })
  });

  assert.throws(() => {
    service.deleteTicketExternalReference({
      ticketId: "ticket-1",
      refId: "missing-ref",
      user: { id: "dev-1", role: "developer" }
    });
  }, (error) => error.code === "external_reference_not_found" && error.status === 404);
});

test("tickets service ticket external references throws ticket_not_found", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return undefined;
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.getTicketExternalReferences({
      ticketId: "missing-ticket",
      user: { id: "dev-1", role: "developer" }
    });
  }, (error) => error.code === "ticket_not_found" && error.status === 404);
});

test("tickets service ticket external references throws forbidden for non-owner user", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "owner-1" };
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.getTicketExternalReferences({
      ticketId: "ticket-1",
      user: { id: "user-1", role: "user" }
    });
  }, (error) => error.code === "forbidden" && error.status === 403);
});

test("tickets service returns ticket detail for developer with full comments", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          assert.deepEqual(params, ["ticket-1"]);
          return { id: "ticket-1", reporter_id: "user-1", title: "Sample ticket" };
        }
        return { count: 0 };
      },
      rowsFactory: (sql, params) => {
        if (sql.includes("FROM comments c")) {
          assert.doesNotMatch(sql, /c\.is_internal = 0/);
          assert.deepEqual(params, ["ticket-1"]);
          return [{ id: "comment-1", is_internal: 1 }];
        }
        if (sql.includes("FROM attachments")) {
          return [{ id: "attachment-1" }];
        }
        if (sql.includes("FROM ticket_history h")) {
          return [{ id: "history-1" }];
        }
        if (sql.includes("FROM ticket_relations tr")) {
          return [{ id: "related-1" }];
        }
        if (sql.includes("FROM ticket_external_references r")) {
          return [{ id: "ref-1" }];
        }
        return [];
      }
    })
  });

  const payload = service.getTicketDetail({
    ticketId: "ticket-1",
    user: { id: "dev-1", role: "developer" }
  });

  assert.equal(payload.id, "ticket-1");
  assert.equal(payload.comments.length, 1);
  assert.equal(payload.attachments.length, 1);
  assert.equal(payload.history.length, 1);
  assert.equal(payload.related_tickets.length, 1);
  assert.equal(payload.external_references.length, 1);
});

test("tickets service returns ticket detail for user with only public comments", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql, params) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          assert.deepEqual(params, ["ticket-1"]);
          return { id: "ticket-1", reporter_id: "user-1", title: "Sample ticket" };
        }
        return { count: 0 };
      },
      rowsFactory: (sql) => {
        if (sql.includes("FROM comments c")) {
          assert.match(sql, /c\.is_internal = 0/);
          return [{ id: "comment-public-1", is_internal: 0 }];
        }
        if (sql.includes("FROM attachments")) {
          return [{ id: "attachment-1" }];
        }
        if (sql.includes("FROM ticket_history h")) {
          return [{ id: "history-1" }];
        }
        if (sql.includes("FROM ticket_relations tr")) {
          return [{ id: "related-1" }];
        }
        if (sql.includes("FROM ticket_external_references r")) {
          return [{ id: "ref-1" }];
        }
        return [];
      }
    })
  });

  const payload = service.getTicketDetail({
    ticketId: "ticket-1",
    user: { id: "user-1", role: "user" }
  });

  assert.equal(payload.comments.length, 1);
  assert.equal(payload.comments[0].id, "comment-public-1");
});

test("tickets service ticket detail throws ticket_not_found when ticket is missing", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return undefined;
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.getTicketDetail({
      ticketId: "ticket-missing",
      user: { id: "dev-1", role: "developer" }
    });
  }, (error) => error.code === "ticket_not_found" && error.status === 404);
});

test("tickets service ticket detail throws forbidden for non-owner user", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      getFactory: (sql) => {
        if (sql.includes("SELECT * FROM tickets WHERE id = ?")) {
          return { id: "ticket-1", reporter_id: "other-user" };
        }
        return { count: 0 };
      }
    })
  });

  assert.throws(() => {
    service.getTicketDetail({
      ticketId: "ticket-1",
      user: { id: "user-1", role: "user" }
    });
  }, (error) => error.code === "forbidden" && error.status === 403);
});

test("tickets service returns board grouped by known statuses with _stats", () => {
  const capture = { sql: "", params: [] };
  const rows = [
    { id: "t-1", status: "submitted" },
    { id: "t-2", status: "submitted" },
    { id: "t-3", status: "verified" },
    { id: "t-4", status: "in_progress" },
    { id: "t-5", status: "closed" },
    { id: "t-x", status: "unknown_status" }
  ];
  const service = createTicketsService({
    db: createDbStub(capture, { rowsFactory: () => rows })
  });

  const payload = service.getBoard();

  assert.match(capture.sql, /FROM tickets t/);
  for (const status of TICKET_STATUSES) {
    assert.equal(Array.isArray(payload[status]), true);
  }
  assert.equal(payload.submitted.length, 2);
  assert.equal(payload.verified.length, 1);
  assert.equal(payload.in_progress.length, 1);
  assert.equal(payload.closed.length, 1);
  assert.equal(payload.blocked.length, 0);
  assert.equal(payload.waiting.length, 0);
  assert.deepEqual(payload._stats, {
    submitted: 2,
    verified: 1,
    in_progress: 1,
    waiting: 0,
    blocked: 0,
    closed: 1
  });
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

test("tickets service returns usage stats payload with coverage and 14-day timeline", () => {
  const capture = { sql: "", params: [] };
  const today = new Date();
  const utcDate = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
  const service = createTicketsService({
    db: createDbStub(capture, {
      rowsFactory: (sql) => {
        if (sql.includes("GROUP BY event_name")) {
          return [
            {
              event_name: "ticket.created",
              count: 4,
              unique_users: 3,
              last_event_at: "2026-02-22 10:00:00"
            },
            {
              event_name: "board.drag",
              count: 2,
              unique_users: 1,
              last_event_at: "2026-02-23 08:30:00"
            }
          ];
        }
        if (sql.includes("GROUP BY day, event_name")) {
          return [
            { day: utcDate, event_name: "ticket.created", count: 1 },
            { day: utcDate, event_name: "board.drag", count: 1 }
          ];
        }
        return [];
      },
      getFactory: (sql) => {
        if (sql.includes("events_count")) {
          return { events_count: 6, unique_users_count: 4, active_days_count: 3 };
        }
        if (sql.includes("WHERE event_name IN")) {
          return { count: 6 };
        }
        return { count: 8 };
      }
    })
  });

  const payload = service.getUsageStats();

  assert.equal(payload.window_days, 30);
  assert.equal(payload.events.ticket_created.count_30d, 4);
  assert.equal(payload.events.board_drag.count_30d, 2);
  assert.equal(payload.events.closure_summary_added.count_30d, 0);
  assert.deepEqual(payload.totals, {
    events_30d: 6,
    unique_users_30d: 4,
    active_days_30d: 3
  });
  assert.equal(payload.daily_breakdown_14d.length, 14);
  const timelineTotal = payload.daily_breakdown_14d.reduce((sum, row) => sum + (row.total || 0), 0);
  assert.equal(timelineTotal, 2);
  assert.deepEqual(payload.known_events_coverage_30d, {
    known_events_count: 6,
    all_events_count: 8,
    coverage_percent: 75
  });
});

test("tickets service usage stats defaults coverage to 100 for empty telemetry window", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      rowsFactory: () => [],
      getFactory: (sql) => {
        if (sql.includes("events_count")) {
          return { events_count: 0, unique_users_count: 0, active_days_count: 0 };
        }
        return { count: 0 };
      }
    })
  });

  const payload = service.getUsageStats();

  assert.equal(payload.daily_breakdown_14d.length, 14);
  assert.deepEqual(payload.known_events_coverage_30d, {
    known_events_count: 0,
    all_events_count: 0,
    coverage_percent: 100
  });
});

test("tickets service returns closure summary index feed with mapped items", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      rowsFactory: (sql, params) => {
        if (!sql.includes("WITH latest_summaries")) {
          return [];
        }
        assert.deepEqual(params, [5]);
        return [
          {
            summary_id: "comment-1",
            summary_content: "Naprawiono błąd logowania.",
            summary_created_at: "2026-02-20 10:00:00",
            ticket_id: "ticket-1",
            ticket_number: 1,
            ticket_title: "Login crash",
            ticket_status: "closed",
            ticket_priority: "critical",
            ticket_category: "bug",
            ticket_updated_at: "2026-02-20 10:05:00",
            summary_author_name: "Dev User",
            summary_author_email: "dev@example.com"
          }
        ];
      }
    })
  });

  const payload = service.getClosureSummaryIndexFeed({
    limit: 5
  });

  assert.equal(typeof payload.generated_at, "string");
  assert.equal(payload.count, 1);
  assert.equal(payload.items.length, 1);
  assert.deepEqual(payload.items[0], {
    index_key: "ticket:ticket-1:summary:comment-1",
    summary_comment_id: "comment-1",
    summary_content: "Naprawiono błąd logowania.",
    summary_created_at: "2026-02-20 10:00:00",
    summary_author_name: "Dev User",
    summary_author_email: "dev@example.com",
    ticket_id: "ticket-1",
    ticket_number: 1,
    ticket_title: "Login crash",
    ticket_status: "closed",
    ticket_priority: "critical",
    ticket_category: "bug",
    ticket_updated_at: "2026-02-20 10:05:00"
  });
});

test("tickets service closure summary index feed applies updatedSince filter param", () => {
  const capture = { sql: "", params: [] };
  const service = createTicketsService({
    db: createDbStub(capture, {
      rowsFactory: (sql, params) => {
        if (!sql.includes("WITH latest_summaries")) {
          return [];
        }
        assert.match(sql, /WHERE datetime\(ls\.summary_created_at\) >= datetime\(\?\)/);
        assert.deepEqual(params, ["2026-02-20T00:00:00Z", 10]);
        return [];
      }
    })
  });

  const payload = service.getClosureSummaryIndexFeed({
    limit: 10,
    updatedSince: "2026-02-20T00:00:00Z"
  });

  assert.equal(payload.count, 0);
  assert.equal(payload.items.length, 0);
});
