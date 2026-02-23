const test = require("node:test");
const assert = require("node:assert/strict");
const { createTicketsService } = require("../services/tickets");
const { TICKET_STATUSES } = require("../constants");

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
