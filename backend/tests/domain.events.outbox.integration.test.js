const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const { cleanupTestEnv, initTestEnv, loginByOtp, makeBugPayload, uniqueEmail } = require("./helpers");

let envRoot;
let db;
let request;
let userAuth;
let devAuth;
let domainEventsService;

test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;

  const app = require("../app");
  db = require("../db");
  request = supertest(app);
  ({ domainEventsService } = require("../services/domain-events"));

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );

  const devEmail = uniqueEmail("dev-events-outbox");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );

  userAuth = await loginByOtp({ request, db, email: uniqueEmail("user-events-outbox") });
  devAuth = await loginByOtp({ request, db, email: devEmail });
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

test("events outbox endpoint requires authentication", async () => {
  const response = await request.get("/api/settings/events/outbox");
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, "unauthorized");
});

test("events outbox endpoint keeps RBAC for standard user", async () => {
  const response = await request
    .get("/api/settings/events/outbox")
    .set("Authorization", `Bearer ${userAuth.token}`);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "forbidden");
});

test("events outbox worker stats endpoint requires authentication", async () => {
  const response = await request.get("/api/settings/events/outbox/stats");
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, "unauthorized");
});

test("events outbox worker stats endpoint keeps RBAC for standard user", async () => {
  const response = await request
    .get("/api/settings/events/outbox/stats")
    .set("Authorization", `Bearer ${userAuth.token}`);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "forbidden");
});

test("events outbox worker stats endpoint returns queue and runtime payload for developer", async () => {
  const response = await request
    .get("/api/settings/events/outbox/stats")
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(response.statusCode, 200);
  assert.equal(typeof response.body.generated_at, "string");
  assert.equal(typeof response.body.queue, "object");
  assert.equal(typeof response.body.runtime, "object");
  assert.equal(typeof response.body.config, "object");
  assert.equal(typeof response.body.queue.total, "number");
  assert.equal(typeof response.body.queue.due_now, "number");
  assert.equal(typeof response.body.runtime.is_running, "boolean");
  assert.equal(typeof response.body.runtime.ticks_total, "number");
});

test("creating ticket writes ticket.created event into durable outbox", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Outbox domain event should exist after create ticket"
      })
    );

  assert.equal(created.statusCode, 201);
  assert.equal(typeof created.body.id, "string");

  const row = db
    .prepare(
      `SELECT
        eo.event_name AS event_name,
        eo.status AS outbox_status,
        de.aggregate_id AS aggregate_id,
        de.actor_user_id AS actor_user_id,
        de.payload_json AS payload_json
      FROM event_outbox eo
      JOIN domain_events de ON de.id = eo.event_id
      WHERE de.aggregate_type = 'ticket'
        AND de.aggregate_id = ?
        AND eo.event_name = 'ticket.created'
      ORDER BY datetime(eo.created_at) DESC
      LIMIT 1`
    )
    .get(created.body.id);

  assert.ok(row);
  assert.equal(row.event_name, "ticket.created");
  assert.equal(row.outbox_status, "pending");
  assert.equal(row.aggregate_id, created.body.id);
  assert.equal(row.actor_user_id, userAuth.user.id);

  const payload = JSON.parse(row.payload_json || "{}");
  assert.equal(payload.status, "submitted");
  assert.equal(payload.category, "bug");
});

test("updating ticket status writes ticket.status_changed event into durable outbox", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Outbox status_changed event should exist after update"
      })
    );

  assert.equal(created.statusCode, 201);

  const updated = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });

  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.status, "verified");

  const row = db
    .prepare(
      `SELECT
        eo.event_name AS event_name,
        eo.status AS outbox_status,
        de.aggregate_id AS aggregate_id,
        de.actor_user_id AS actor_user_id,
        de.payload_json AS payload_json
      FROM event_outbox eo
      JOIN domain_events de ON de.id = eo.event_id
      WHERE de.aggregate_type = 'ticket'
        AND de.aggregate_id = ?
        AND eo.event_name = 'ticket.status_changed'
      ORDER BY datetime(eo.created_at) DESC
      LIMIT 1`
    )
    .get(created.body.id);

  assert.ok(row);
  assert.equal(row.event_name, "ticket.status_changed");
  assert.equal(row.outbox_status, "pending");
  assert.equal(row.aggregate_id, created.body.id);
  assert.equal(row.actor_user_id, devAuth.user.id);

  const payload = JSON.parse(row.payload_json || "{}");
  assert.equal(payload.old_status, "submitted");
  assert.equal(payload.new_status, "verified");
});

test("updating ticket planning writes task.synced event into durable outbox", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Outbox task.synced event should exist after planning update"
      })
    );

  assert.equal(created.statusCode, 201);

  const updated = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      assignee_id: devAuth.user.id
    });

  assert.equal(updated.statusCode, 200);

  const row = db
    .prepare(
      `SELECT
        eo.event_name AS event_name,
        eo.status AS outbox_status,
        de.aggregate_id AS aggregate_id,
        de.actor_user_id AS actor_user_id,
        de.payload_json AS payload_json
      FROM event_outbox eo
      JOIN domain_events de ON de.id = eo.event_id
      WHERE de.aggregate_type = 'ticket'
        AND de.aggregate_id = ?
        AND eo.event_name = 'task.synced'
      ORDER BY datetime(eo.created_at) DESC
      LIMIT 1`
    )
    .get(created.body.id);

  assert.ok(row);
  assert.equal(row.event_name, "task.synced");
  assert.equal(row.outbox_status, "pending");
  assert.equal(row.aggregate_id, created.body.id);
  assert.equal(row.actor_user_id, devAuth.user.id);

  const payload = JSON.parse(row.payload_json || "{}");
  assert.equal(payload.ticket_status, "verified");
  assert.equal(payload.assignee_id, devAuth.user.id);
  assert.equal(payload.normalized, true);
  assert.equal(payload.ensured, true);
});

test("closing ticket writes ticket.closed event into durable outbox", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Outbox ticket.closed event should exist after closing ticket"
      })
    );

  assert.equal(created.statusCode, 201);

  const summary = await request
    .post(`/api/tickets/${created.body.id}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      content: "Podsumowanie zamknięcia dla eventu domenowego ticket.closed.",
      is_internal: false,
      is_closure_summary: true,
      type: "comment"
    });
  assert.equal(summary.statusCode, 201);

  const closed = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "closed" });

  assert.equal(closed.statusCode, 200);
  assert.equal(closed.body.status, "closed");

  const row = db
    .prepare(
      `SELECT
        eo.event_name AS event_name,
        eo.status AS outbox_status,
        de.aggregate_id AS aggregate_id,
        de.actor_user_id AS actor_user_id,
        de.payload_json AS payload_json
      FROM event_outbox eo
      JOIN domain_events de ON de.id = eo.event_id
      WHERE de.aggregate_type = 'ticket'
        AND de.aggregate_id = ?
        AND eo.event_name = 'ticket.closed'
      ORDER BY datetime(eo.created_at) DESC
      LIMIT 1`
    )
    .get(created.body.id);

  assert.ok(row);
  assert.equal(row.event_name, "ticket.closed");
  assert.equal(row.outbox_status, "pending");
  assert.equal(row.aggregate_id, created.body.id);
  assert.equal(row.actor_user_id, devAuth.user.id);

  const payload = JSON.parse(row.payload_json || "{}");
  assert.equal(payload.old_status, "submitted");
  assert.equal(payload.new_status, "closed");
});

test("events outbox endpoint returns persisted outbox items for developer", async () => {
  domainEventsService.publishDomainEvent({
    eventName: "ticket.created",
    aggregateType: "ticket",
    aggregateId: "ticket-100",
    actorUserId: devAuth.user.id,
    payload: { status: "submitted" }
  });

  domainEventsService.publishDomainEvent({
    eventName: "ticket.closed",
    aggregateType: "ticket",
    aggregateId: "ticket-101",
    actorUserId: devAuth.user.id,
    payload: { status: "closed" }
  });

  const response = await request
    .get("/api/settings/events/outbox?limit=50")
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(response.statusCode, 200);
  assert.equal(typeof response.body.generated_at, "string");
  assert.equal(Array.isArray(response.body.items), true);
  assert.ok(response.body.count >= 2);

  const names = response.body.items.map((item) => item.event_name);
  assert.ok(names.includes("ticket.created"));
  assert.ok(names.includes("ticket.closed"));
});

test("events outbox endpoint supports status filter", async () => {
  const response = await request
    .get("/api/settings/events/outbox?status=pending&limit=20")
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(response.body.items), true);
  for (const item of response.body.items) {
    assert.equal(item.status, "pending");
  }
});
