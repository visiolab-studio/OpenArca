const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const {
  cleanupTestEnv,
  initTestEnv,
  loginByOtp,
  makeBugPayload,
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

test("activation stats endpoint blocks non-developer role", async () => {
  const forbidden = await request
    .get("/api/tickets/stats/activation")
    .set("Authorization", `Bearer ${userAuth.token}`);

  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.body.error, "forbidden");
});

test("activation stats endpoint returns deterministic activation metrics", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Activation metrics should include first ticket and first assignment"
      })
    );
  assert.equal(created.statusCode, 201);

  const accepted = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });
  assert.equal(accepted.statusCode, 200);

  const userCreatedAt = "2026-01-01 10:00:00";
  const firstTicketAt = "2026-01-01 10:15:00";
  const firstAssignmentAt = "2026-01-01 10:40:00";

  db.prepare("UPDATE users SET created_at = ? WHERE id = ?").run(
    userCreatedAt,
    userAuth.user.id
  );
  db.prepare("UPDATE tickets SET created_at = ?, updated_at = ? WHERE id = ?").run(
    firstTicketAt,
    firstTicketAt,
    created.body.id
  );
  db.prepare(
    `UPDATE ticket_history
     SET created_at = ?
     WHERE ticket_id = ? AND field = 'assignee_id'`
  ).run(firstAssignmentAt, created.body.id);

  const result = await request
    .get("/api/tickets/stats/activation")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(result.statusCode, 200);

  assert.equal(typeof result.body.generated_at, "string");
  assert.equal(result.body.users_total, 1);
  assert.equal(result.body.users_with_first_ticket, 1);
  assert.equal(result.body.users_with_first_dev_assignment, 1);

  assert.deepEqual(result.body.time_to_first_ticket_minutes, {
    avg_minutes: 15,
    median_minutes: 15,
    sample_size: 1
  });
  assert.deepEqual(result.body.time_to_first_dev_assignment_minutes, {
    avg_minutes: 25,
    median_minutes: 25,
    sample_size: 1
  });
  assert.deepEqual(result.body.first_dev_assignment_under_30m, {
    within_target_count: 1,
    within_target_percent: 100,
    sample_size: 1
  });
});
