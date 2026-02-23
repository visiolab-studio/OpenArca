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

  const devEmail = uniqueEmail("dev-capabilities");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );

  userAuth = await loginByOtp({ request, db, email: uniqueEmail("user-capabilities") });
  devAuth = await loginByOtp({ request, db, email: devEmail });
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

test("capabilities endpoint requires authentication", async () => {
  const response = await request.get("/api/settings/capabilities");
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, "unauthorized");
});

test("capabilities endpoint returns open_core defaults for authenticated user", async () => {
  const response = await request
    .get("/api/settings/capabilities")
    .set("Authorization", `Bearer ${userAuth.token}`);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.edition, "open_core");
  assert.equal(typeof response.body.generated_at, "string");
  assert.equal(response.body.capabilities.core_tickets, true);
  assert.equal(response.body.capabilities.core_board, true);
  assert.equal(response.body.capabilities.enterprise_automation, false);
  assert.equal(response.body.capabilities.enterprise_ai_recall, false);
});

test("capabilities endpoint applies enterprise edition and feature flag overrides", async () => {
  db.prepare("UPDATE settings SET value = ? WHERE key = 'edition'").run("enterprise");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'feature_flags'").run(
    JSON.stringify({
      enterprise_sso_google: false,
      enterprise_ai_recall: true,
      core_admin: false
    })
  );

  const response = await request
    .get("/api/settings/capabilities")
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.edition, "enterprise");
  assert.equal(response.body.capabilities.enterprise_automation, true);
  assert.equal(response.body.capabilities.enterprise_sso_google, false);
  assert.equal(response.body.capabilities.enterprise_ai_recall, true);
  assert.equal(response.body.capabilities.core_admin, false);
});
