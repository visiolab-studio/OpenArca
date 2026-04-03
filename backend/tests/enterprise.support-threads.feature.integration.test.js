const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const { cleanupTestEnv, initTestEnv, loginByOtp, uniqueEmail } = require("./helpers");

function resetAppModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}backend${path.sep}`)) {
      delete require.cache[key];
    }
  }
}

let envRoot;
let db;
let request;
let devAuth;
let previousRoutesFile;

test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;
  previousRoutesFile = process.env.EXTENSIONS_ROUTES_FILE;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openarca-support-threads-routes-"));
  const routesFile = path.join(tmpDir, "routes.js");

  fs.writeFileSync(
    routesFile,
    [
      "module.exports = ({ app, express, middlewares }) => {",
      "  const router = express.Router();",
      "  router.get(",
      "    '/api/enterprise/support-threads/health',",
      "    middlewares.authRequired,",
      "    middlewares.requireRole('developer'),",
      "    middlewares.requireFeature('enterprise_support_threads'),",
      "    (_req, res) => res.json({ ok: true, module: 'support_threads', provider: 'enterprise' })",
      "  );",
      "  app.use(router);",
      "};"
    ].join("\n"),
    "utf8"
  );

  process.env.EXTENSIONS_ROUTES_FILE = routesFile;
  resetAppModules();

  const app = require("../app");
  db = require("../db");
  request = supertest(app);

  const devEmail = uniqueEmail("dev-support-threads");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );

  devAuth = await loginByOtp({ request, db, email: devEmail });

  test.after(() => {
    process.env.EXTENSIONS_ROUTES_FILE = previousRoutesFile;
    resetAppModules();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

test("support threads enterprise route blocks when feature is disabled", async () => {
  db.prepare("UPDATE settings SET value = ? WHERE key = 'edition'").run("open_core");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'feature_flags'").run("{}");

  const response = await request
    .get("/api/enterprise/support-threads/health")
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "feature_not_enabled");
  assert.equal(response.body.feature, "enterprise_support_threads");
});

test("support threads enterprise route allows developer when feature is enabled", async () => {
  db.prepare("UPDATE settings SET value = ? WHERE key = 'edition'").run("enterprise");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'feature_flags'").run("{}");

  const response = await request
    .get("/api/enterprise/support-threads/health")
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.module, "support_threads");
  assert.equal(response.body.provider, "enterprise");
});
