const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveLayers, inRouteOrder, parseLayerList } = require("../core/layer-resolver");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openarca-layers-"));
}

function createLayer(rootDir, name, options = {}) {
  const layerRoot = path.join(rootDir, name);
  fs.mkdirSync(path.join(layerRoot, "backend", "extensions"), { recursive: true });
  fs.mkdirSync(path.join(layerRoot, "frontend", "extensions"), { recursive: true });

  if (options.manifest !== false) {
    fs.writeFileSync(
      path.join(layerRoot, "layer.json"),
      JSON.stringify({ name, requires: options.requires || [] }),
      "utf8"
    );
  }

  if (options.withRoutes !== false) {
    fs.writeFileSync(
      path.join(layerRoot, "backend", "extensions", "routes.js"),
      "module.exports = { register() {} };",
      "utf8"
    );
  }

  return layerRoot;
}

test("parseLayerList trims entries and drops empties", () => {
  assert.deepEqual(parseLayerList(" a , b ,, c "), ["a", "b", "c"]);
  assert.deepEqual(parseLayerList(""), []);
  assert.deepEqual(parseLayerList(undefined), []);
});

test("resolves configured layers in order, lowest first", () => {
  const tmpDir = createTempDir();
  createLayer(tmpDir, "enterprise");
  createLayer(tmpDir, "edudoro", { requires: ["enterprise"] });

  const { layers } = resolveLayers({
    env: { EXTENSIONS_LAYERS: "enterprise,edudoro" },
    rootDir: tmpDir
  });

  assert.deepEqual(
    layers.map((layer) => layer.name),
    ["enterprise", "edudoro"]
  );
  assert.equal(layers[0].source, "EXTENSIONS_LAYERS");
  assert.ok(layers[1].routesFile.endsWith(path.join("edudoro", "backend", "extensions", "routes.js")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("route order is the reverse of layer order so the topmost layer wins", () => {
  const tmpDir = createTempDir();
  createLayer(tmpDir, "enterprise");
  createLayer(tmpDir, "edudoro", { requires: ["enterprise"] });

  const { layers } = resolveLayers({
    env: { EXTENSIONS_LAYERS: "enterprise,edudoro" },
    rootDir: tmpDir
  });

  assert.deepEqual(
    inRouteOrder(layers).map((layer) => layer.name),
    ["edudoro", "enterprise"]
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a layer root that does not exist is a boot failure naming the path", () => {
  const tmpDir = createTempDir();

  assert.throws(
    () => resolveLayers({ env: { EXTENSIONS_LAYERS: "missing-layer" }, rootDir: tmpDir }),
    /Extension layer path does not exist: "missing-layer"/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a missing prerequisite aborts, naming both layers", () => {
  const tmpDir = createTempDir();
  createLayer(tmpDir, "edudoro", { requires: ["enterprise"] });

  assert.throws(
    () => resolveLayers({ env: { EXTENSIONS_LAYERS: "edudoro" }, rootDir: tmpDir }),
    /Layer "edudoro" requires layer "enterprise"/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a prerequisite declared above the declaring layer does not satisfy it", () => {
  const tmpDir = createTempDir();
  createLayer(tmpDir, "enterprise");
  createLayer(tmpDir, "edudoro", { requires: ["enterprise"] });

  // edudoro listed BELOW enterprise: the prerequisite is loaded after it.
  assert.throws(
    () => resolveLayers({ env: { EXTENSIONS_LAYERS: "edudoro,enterprise" }, rootDir: tmpDir }),
    /requires layer "enterprise", which is not loaded below it/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a layer without a manifest takes its directory name and declares nothing", () => {
  const tmpDir = createTempDir();
  createLayer(tmpDir, "plainlayer", { manifest: false });

  const { layers } = resolveLayers({
    env: { EXTENSIONS_LAYERS: "plainlayer" },
    rootDir: tmpDir
  });

  assert.equal(layers[0].name, "plainlayer");
  assert.deepEqual(layers[0].requires, []);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a malformed manifest fails loudly", () => {
  const tmpDir = createTempDir();
  const layerRoot = createLayer(tmpDir, "broken");
  fs.writeFileSync(path.join(layerRoot, "layer.json"), "{ not json", "utf8");

  assert.throws(
    () => resolveLayers({ env: { EXTENSIONS_LAYERS: "broken" }, rootDir: tmpDir }),
    /Invalid layer.json in layer/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("legacy env vars synthesize a single implicit layer", () => {
  const tmpDir = createTempDir();
  const extensionsDir = path.join(tmpDir, "extensions");
  fs.mkdirSync(extensionsDir, { recursive: true });
  fs.writeFileSync(path.join(extensionsDir, "service-overrides.js"), "module.exports = {};", "utf8");

  const { layers, warnings } = resolveLayers({
    env: { EXTENSIONS_DIR: extensionsDir },
    rootDir: tmpDir,
    defaults: { extensionsDir }
  });

  assert.equal(layers.length, 1);
  assert.equal(layers[0].source, "legacy");
  assert.ok(layers[0].overridesFile.endsWith("service-overrides.js"));
  assert.ok(warnings.some((warning) => warning.includes("deprecated")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("legacy files that do not exist stay a silent skip", () => {
  const tmpDir = createTempDir();
  const extensionsDir = path.join(tmpDir, "extensions");
  fs.mkdirSync(extensionsDir, { recursive: true });

  const { layers } = resolveLayers({
    env: {},
    rootDir: tmpDir,
    defaults: { extensionsDir }
  });

  assert.equal(layers.length, 1);
  assert.equal(layers[0].overridesFile, "");
  assert.equal(layers[0].routesFile, "");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("EXTENSIONS_LAYERS wins over legacy vars and says so", () => {
  const tmpDir = createTempDir();
  createLayer(tmpDir, "enterprise");

  const { layers, warnings } = resolveLayers({
    env: {
      EXTENSIONS_LAYERS: "enterprise",
      EXTENSIONS_OVERRIDES_FILE: "/somewhere/service-overrides.js"
    },
    rootDir: tmpDir
  });

  assert.equal(layers.length, 1);
  assert.equal(layers[0].name, "enterprise");
  assert.ok(warnings.some((warning) => warning.includes("are ignored")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
