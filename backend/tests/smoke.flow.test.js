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
let developerEmail;

test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;

  const app = require("../app");
  db = require("../db");
  request = supertest(app);

  developerEmail = uniqueEmail("developer");

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([developerEmail])
  );
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

test("smoke: user -> developer -> user main flow", async () => {
  const reporterEmail = uniqueEmail("reporter");

  const reporter = await loginByOtp({ request, db, email: reporterEmail });
  const developer = await loginByOtp({ request, db, email: developerEmail });

  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${reporter.token}`)
    .field(makeBugPayload({ title: "Krytyczny błąd logowania do panelu" }));

  assert.equal(created.statusCode, 201);
  assert.ok(created.body.id);

  const updated = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${developer.token}`)
    .send({ status: "verified", priority: "high" });

  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.status, "verified");

  const comment = await request
    .post(`/api/tickets/${created.body.id}/comments`)
    .set("Authorization", `Bearer ${developer.token}`)
    .send({ content: "Potwierdzam błąd. Przekazuję do realizacji.", type: "comment" });

  assert.equal(comment.statusCode, 201);

  const visibleForReporter = await request
    .get(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${reporter.token}`);

  assert.equal(visibleForReporter.statusCode, 200);
  assert.equal(visibleForReporter.body.status, "verified");
  assert.equal(visibleForReporter.body.comments.length, 1);
  assert.equal(visibleForReporter.body.comments[0].content.includes("Potwierdzam błąd"), true);
});
