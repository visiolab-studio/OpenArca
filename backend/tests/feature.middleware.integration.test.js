const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const { cleanupTestEnv, initTestEnv, loginByOtp, uniqueEmail } = require("./helpers");

let envRoot;
let db;
let request;
let userAuth;
let devAuth;

test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;

  const app = require("../app");
  db = require("../db");
  request = supertest(app);

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );

  const devEmail = uniqueEmail("dev-feature");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );

  userAuth = await loginByOtp({ request, db, email: uniqueEmail("user-feature") });
  devAuth = await loginByOtp({ request, db, email: devEmail });
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

test("enterprise check requires authentication", async () => {
  const response = await request.get("/api/settings/enterprise-check");
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, "unauthorized");
});

test("enterprise check keeps RBAC for user role", async () => {
  const response = await request
    .get("/api/settings/enterprise-check")
    .set("Authorization", `Bearer ${userAuth.token}`);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "forbidden");
});

test("enterprise check blocks developer when feature is disabled", async () => {
  db.prepare("UPDATE settings SET value = ? WHERE key = 'edition'").run("open_core");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'feature_flags'").run("{}");

  const response = await request
    .get("/api/settings/enterprise-check")
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "feature_not_enabled");
  assert.equal(response.body.feature, "enterprise_automation");
});

test("enterprise check allows developer when edition enables enterprise automation", async () => {
  db.prepare("UPDATE settings SET value = ? WHERE key = 'edition'").run("enterprise");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'feature_flags'").run("{}");

  const response = await request
    .get("/api/settings/enterprise-check")
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.checked_feature, "enterprise_automation");
  assert.equal(typeof response.body.generated_at, "string");
});

test("enterprise check honors explicit feature flag override to disable", async () => {
  db.prepare("UPDATE settings SET value = ? WHERE key = 'edition'").run("enterprise");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'feature_flags'").run(
    JSON.stringify({ enterprise_automation: false })
  );

  const response = await request
    .get("/api/settings/enterprise-check")
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "feature_not_enabled");
  assert.equal(response.body.feature, "enterprise_automation");
});
