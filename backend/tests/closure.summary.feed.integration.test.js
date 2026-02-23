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
let app;
let db;
let request;
let userAuth;
let devAuth;

test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;

  app = require("../app");
  db = require("../db");
  request = supertest(app);

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );

  const devEmail = uniqueEmail("dev-index");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );

  userAuth = await loginByOtp({
    request,
    db,
    email: uniqueEmail("user-index")
  });

  devAuth = await loginByOtp({ request, db, email: devEmail });
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

test("closure summary index feed blocks non-developer role", async () => {
  const forbidden = await request
    .get("/api/tickets/closure-summaries/index-feed")
    .set("Authorization", `Bearer ${userAuth.token}`);

  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.body.error, "forbidden");
});

test("closure summary index feed returns latest public summary per ticket", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(makeBugPayload({ title: "Ticket for closure summary index feed" }));
  assert.equal(created.statusCode, 201);

  const moveToVerified = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });
  assert.equal(moveToVerified.statusCode, 200);

  const firstSummary = await request
    .post(`/api/tickets/${created.body.id}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      content: "Pierwsze podsumowanie zamknięcia.",
      is_closure_summary: true
    });
  assert.equal(firstSummary.statusCode, 201);

  const secondSummary = await request
    .post(`/api/tickets/${created.body.id}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      content: "Drugie, nowsze podsumowanie zamknięcia.",
      is_closure_summary: true
    });
  assert.equal(secondSummary.statusCode, 201);

  const feed = await request
    .get("/api/tickets/closure-summaries/index-feed?limit=10")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(feed.statusCode, 200);
  assert.equal(typeof feed.body.generated_at, "string");
  assert.equal(typeof feed.body.count, "number");
  assert.ok(Array.isArray(feed.body.items));

  const indexed = feed.body.items.find((item) => item.ticket_id === created.body.id);
  assert.ok(indexed);
  assert.equal(indexed.summary_comment_id, secondSummary.body.id);
  assert.equal(indexed.summary_content, "Drugie, nowsze podsumowanie zamknięcia.");
  assert.equal(indexed.ticket_number, created.body.number);
  assert.equal(indexed.index_key, `ticket:${created.body.id}:summary:${secondSummary.body.id}`);
  assert.equal(indexed.ticket_status, "verified");
  assert.ok(indexed.summary_author_email);
});

test("closure summary index feed supports updated_since filter", async () => {
  const feed = await request
    .get("/api/tickets/closure-summaries/index-feed")
    .query({ updated_since: "2999-01-01T00:00:00Z", limit: 25 })
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(feed.statusCode, 200);
  assert.equal(feed.body.count, 0);
  assert.equal(feed.body.items.length, 0);
});
