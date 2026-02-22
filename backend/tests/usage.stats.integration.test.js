const test = require("node:test");
const assert = require("node:assert/strict");
const { v4: uuidv4 } = require("uuid");
const supertest = require("supertest");
const {
  cleanupTestEnv,
  initTestEnv,
  loginByOtp,
  uniqueEmail
} = require("./helpers");

let envRoot;
let request;
let db;
let userAuth;
let devAuth;

test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;

  const app = require("../app");
  db = require("../db");
  request = supertest(app);

  const developerEmail = uniqueEmail("dev");

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([developerEmail])
  );

  userAuth = await loginByOtp({
    request,
    db,
    email: uniqueEmail("user")
  });
  devAuth = await loginByOtp({
    request,
    db,
    email: developerEmail
  });
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

test("feature usage stats endpoint blocks non-developer role", async () => {
  const forbidden = await request
    .get("/api/tickets/stats/usage")
    .set("Authorization", `Bearer ${userAuth.token}`);

  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.body.error, "forbidden");
});

test("feature usage stats endpoint returns aggregated telemetry usage for 30d and 14d", async () => {
  const insertTelemetry = db.prepare(
    `INSERT INTO telemetry_events (
      id, event_name, user_id, ticket_id, properties_json, created_at
    ) VALUES (?, ?, ?, NULL, NULL, datetime('now', ?))`
  );

  insertTelemetry.run(uuidv4(), "ticket.created", userAuth.user.id, "-1 day");
  insertTelemetry.run(uuidv4(), "ticket.created", userAuth.user.id, "-31 days");
  insertTelemetry.run(uuidv4(), "ticket.closed", devAuth.user.id, "-2 days");
  insertTelemetry.run(uuidv4(), "board.drag", devAuth.user.id, "-2 days");
  insertTelemetry.run(uuidv4(), "devtodo.reorder", devAuth.user.id, "-3 days");
  insertTelemetry.run(uuidv4(), "devtodo.reorder", null, "-3 days");
  insertTelemetry.run(uuidv4(), "closure_summary_added", devAuth.user.id, "-1 day");
  insertTelemetry.run(uuidv4(), "custom.experimental", devAuth.user.id, "-1 day");

  const result = await request
    .get("/api/tickets/stats/usage")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(result.statusCode, 200);

  assert.equal(typeof result.body.generated_at, "string");
  assert.equal(result.body.window_days, 30);

  assert.equal(result.body.events.ticket_created.count_30d, 1);
  assert.equal(result.body.events.ticket_closed.count_30d, 1);
  assert.equal(result.body.events.board_drag.count_30d, 1);
  assert.equal(result.body.events.devtodo_reorder.count_30d, 2);
  assert.equal(result.body.events.closure_summary_added.count_30d, 1);
  assert.equal(result.body.events.devtodo_reorder.unique_users_30d, 1);

  assert.equal(result.body.totals.events_30d, 6);
  assert.equal(result.body.totals.unique_users_30d, 2);
  assert.equal(result.body.totals.active_days_30d, 3);

  assert.equal(result.body.known_events_coverage_30d.known_events_count, 6);
  assert.equal(result.body.known_events_coverage_30d.all_events_count, 7);
  assert.equal(result.body.known_events_coverage_30d.coverage_percent, 85.71);

  assert.ok(Array.isArray(result.body.daily_breakdown_14d));
  assert.equal(result.body.daily_breakdown_14d.length, 14);

  const minusThreeDay = db
    .prepare("SELECT date(datetime('now', '-3 days')) AS day")
    .get().day;
  const minusThreeEntry = result.body.daily_breakdown_14d.find((entry) => entry.date === minusThreeDay);
  assert.ok(minusThreeEntry);
  assert.equal(minusThreeEntry.devtodo_reorder, 2);
  assert.equal(minusThreeEntry.total, 2);
});
