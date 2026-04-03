const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const { loadRoutesRegistrar, registerRoutesExtensions } = require("../core/routes-extension-loader");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openarca-routes-ext-"));
}

test("routes extension loader keeps fallback when routes file is missing", () => {
  const tmpDir = createTempDir();
  const routesFile = path.join(tmpDir, "missing-routes.js");

  assert.equal(loadRoutesRegistrar(routesFile), null);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("routes extension loader mounts routes from external file", async () => {
  const tmpDir = createTempDir();
  const routesFile = path.join(tmpDir, "routes.js");

  fs.writeFileSync(
    routesFile,
    [
      "module.exports = ({ app, express }) => {",
      "  const router = express.Router();",
      "  router.get('/api/enterprise/test', (_req, res) => res.json({ ok: true, provider: 'enterprise-file' }));",
      "  app.use(router);",
      "};"
    ].join("\n"),
    "utf8"
  );

  const app = express();
  registerRoutesExtensions(app, { routesFilePath: routesFile, context: { express } });
  const response = await supertest(app).get("/api/enterprise/test");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.provider, "enterprise-file");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("routes extension loader rejects invalid module format", () => {
  const tmpDir = createTempDir();
  const routesFile = path.join(tmpDir, "routes.js");

  fs.writeFileSync(routesFile, "module.exports = { invalid: true };", "utf8");

  assert.throws(() => loadRoutesRegistrar(routesFile), /Invalid enterprise routes module/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
