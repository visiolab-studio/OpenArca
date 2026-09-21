const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { registerRoutesExtensions } = require("../core/routes-extension-loader");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openarca-routes-layers-"));
}

function writeRoutes(tmpDir, layerName, source) {
  const filePath = path.join(tmpDir, `${layerName}-routes.js`);
  fs.writeFileSync(filePath, source, "utf8");
  return { name: layerName, routesFile: filePath };
}

// A stand-in for the Express app: records the order in which handlers land.
function createAppSpy() {
  const calls = [];
  return {
    calls,
    get(routePath) {
      calls.push(`route:${routePath}`);
    },
    use(marker) {
      calls.push(`middleware:${marker}`);
    }
  };
}

test("both layers mount their routes", () => {
  const tmpDir = createTempDir();
  const enterprise = writeRoutes(
    tmpDir,
    "enterprise",
    "module.exports = { register({ app }){ app.get('/enterprise'); } };"
  );
  const edudoro = writeRoutes(
    tmpDir,
    "edudoro",
    "module.exports = { register({ app }){ app.get('/edudoro'); } };"
  );

  const app = createAppSpy();
  const registered = registerRoutesExtensions(app, { layers: [enterprise, edudoro] });

  assert.equal(registered, true);
  assert.ok(app.calls.includes("route:/enterprise"));
  assert.ok(app.calls.includes("route:/edudoro"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("the topmost layer registers first so it wins a path conflict", () => {
  const tmpDir = createTempDir();
  const enterprise = writeRoutes(
    tmpDir,
    "enterprise",
    "module.exports = { register({ app }){ app.get('/shared-enterprise'); } };"
  );
  const edudoro = writeRoutes(
    tmpDir,
    "edudoro",
    "module.exports = { register({ app }){ app.get('/shared-edudoro'); } };"
  );

  const app = createAppSpy();
  registerRoutesExtensions(app, { layers: [enterprise, edudoro] });

  // Express is first-match-wins, so the topmost layer must register first.
  assert.deepEqual(app.calls, ["route:/shared-edudoro", "route:/shared-enterprise"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("middleware composes in forward order, opposite to routes", () => {
  const tmpDir = createTempDir();
  const enterprise = writeRoutes(
    tmpDir,
    "enterprise",
    "module.exports = { registerMiddleware({ app }){ app.use('enterprise'); }, register({ app }){ app.get('/enterprise'); } };"
  );
  const edudoro = writeRoutes(
    tmpDir,
    "edudoro",
    "module.exports = { registerMiddleware({ app }){ app.use('edudoro'); }, register({ app }){ app.get('/edudoro'); } };"
  );

  const app = createAppSpy();
  registerRoutesExtensions(app, { layers: [enterprise, edudoro] });

  assert.deepEqual(app.calls, [
    "middleware:enterprise",
    "middleware:edudoro",
    "route:/edudoro",
    "route:/enterprise"
  ]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a bare function export is still accepted as routes only", () => {
  const tmpDir = createTempDir();
  const legacy = writeRoutes(
    tmpDir,
    "legacy",
    "module.exports = function register({ app }){ app.get('/legacy'); };"
  );

  const app = createAppSpy();
  registerRoutesExtensions(app, { layers: [legacy] });

  assert.deepEqual(app.calls, ["route:/legacy"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a malformed module names the layer it came from", () => {
  const tmpDir = createTempDir();
  const broken = writeRoutes(tmpDir, "broken", "module.exports = 42;");

  assert.throws(
    () => registerRoutesExtensions(createAppSpy(), { layers: [broken] }),
    /Invalid routes module in layer "broken"/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a layer without a routes file is skipped", () => {
  const tmpDir = createTempDir();
  const missing = { name: "empty", routesFile: path.join(tmpDir, "absent.js") };
  const enterprise = writeRoutes(
    tmpDir,
    "enterprise",
    "module.exports = { register({ app }){ app.get('/enterprise'); } };"
  );

  const app = createAppSpy();
  registerRoutesExtensions(app, { layers: [missing, enterprise] });

  assert.deepEqual(app.calls, ["route:/enterprise"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("no layers at all still returns false", () => {
  const tmpDir = createTempDir();
  const app = createAppSpy();

  const registered = registerRoutesExtensions(app, {
    routesFilePath: path.join(tmpDir, "absent.js")
  });

  assert.equal(registered, false);
  assert.deepEqual(app.calls, []);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
