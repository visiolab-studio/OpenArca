const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { getLayerDiagnostics } = require("../core/layer-diagnostics");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openarca-diagnostics-"));
}

function writeFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "module.exports = {};", "utf8");
  return filePath;
}

test("a core-only install reads as a single row", () => {
  const diagnostics = getLayerDiagnostics({ layers: [], warnings: [] });

  assert.equal(diagnostics.count, 1);
  assert.equal(diagnostics.layers[0].name, "core");
  assert.equal(diagnostics.status, "ready");
});

test("core is always listed first, below every configured layer", () => {
  const tmpDir = createTempDir();
  const layer = {
    name: "enterprise",
    root: tmpDir,
    requires: [],
    routesFile: writeFile(path.join(tmpDir, "routes.js"))
  };

  const diagnostics = getLayerDiagnostics({ layers: [layer], warnings: [] });

  assert.deepEqual(
    diagnostics.layers.map((row) => row.name),
    ["core", "enterprise"]
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("reports which seams a layer actually contributes", () => {
  const tmpDir = createTempDir();
  const layer = {
    name: "partial",
    root: tmpDir,
    requires: [],
    routesFile: writeFile(path.join(tmpDir, "routes.js")),
    overridesFile: path.join(tmpDir, "absent-overrides.js")
  };

  const [, row] = getLayerDiagnostics({ layers: [layer], warnings: [] }).layers;

  assert.deepEqual(row.seams, ["routes"]);
  assert.ok(row.missing_seams.includes("services"));
  assert.ok(row.missing_seams.includes("schema"));
  assert.equal(row.status, "loaded");
});

test("a layer contributing no seam is flagged rather than shown as fine", () => {
  const tmpDir = createTempDir();
  const layer = { name: "hollow", root: tmpDir, requires: [] };

  const diagnostics = getLayerDiagnostics({ layers: [layer], warnings: [] });
  const [, row] = diagnostics.layers;

  // This is the quiet failure the view exists for: the layer loaded, so nothing
  // errored, but it does nothing and the operator has no other way to see that.
  assert.equal(row.status, "contributes_nothing");
  assert.equal(diagnostics.status, "needs_attention");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("declared prerequisites are reported", () => {
  const tmpDir = createTempDir();
  const layer = {
    name: "edudoro",
    root: tmpDir,
    requires: ["enterprise"],
    routesFile: writeFile(path.join(tmpDir, "routes.js"))
  };

  const [, row] = getLayerDiagnostics({ layers: [layer], warnings: [] }).layers;

  assert.deepEqual(row.requires, ["enterprise"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("configuration warnings are passed through", () => {
  const diagnostics = getLayerDiagnostics({
    layers: [],
    warnings: ["EXTENSIONS_LAYERS is set, so legacy variables are ignored."]
  });

  assert.equal(diagnostics.warnings.length, 1);
});
