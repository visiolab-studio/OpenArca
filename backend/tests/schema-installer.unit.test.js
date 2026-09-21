const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { installLayerSchemas } = require("../core/schema-installer");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openarca-schema-"));
}

function writeSchema(tmpDir, layerName, source) {
  const filePath = path.join(tmpDir, `${layerName}-schema.js`);
  fs.writeFileSync(filePath, source, "utf8");
  return { name: layerName, schemaFile: filePath };
}

// A stand-in for the SQLite handle: records the order statements arrive in.
function createDbSpy() {
  return { statements: [] };
}

test("layer schemas install lowest layer first", () => {
  const tmpDir = createTempDir();
  const enterprise = writeSchema(
    tmpDir,
    "enterprise",
    "module.exports = { install(db){ db.statements.push('enterprise'); } };"
  );
  const edudoro = writeSchema(
    tmpDir,
    "edudoro",
    "module.exports = { install(db){ db.statements.push('edudoro'); } };"
  );

  const db = createDbSpy();
  const installed = installLayerSchemas(db, { layers: [enterprise, edudoro] });

  // Forward order matters: layer tables carry foreign keys into lower layers.
  assert.deepEqual(db.statements, ["enterprise", "edudoro"]);
  assert.deepEqual(installed, ["enterprise", "edudoro"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a bare function export is accepted", () => {
  const tmpDir = createTempDir();
  const layer = writeSchema(
    tmpDir,
    "plain",
    "module.exports = function(db){ db.statements.push('plain'); };"
  );

  const db = createDbSpy();
  installLayerSchemas(db, { layers: [layer] });

  assert.deepEqual(db.statements, ["plain"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a layer without a schema file is skipped cleanly", () => {
  const tmpDir = createTempDir();
  const missing = { name: "empty", schemaFile: path.join(tmpDir, "absent.js") };
  const enterprise = writeSchema(
    tmpDir,
    "enterprise",
    "module.exports = { install(db){ db.statements.push('enterprise'); } };"
  );

  const db = createDbSpy();
  const installed = installLayerSchemas(db, { layers: [missing, enterprise] });

  assert.deepEqual(installed, ["enterprise"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("no layers at all installs nothing", () => {
  const db = createDbSpy();
  assert.deepEqual(installLayerSchemas(db, { layers: [] }), []);
  assert.deepEqual(db.statements, []);
});

test("a malformed schema module names the layer", () => {
  const tmpDir = createTempDir();
  const broken = writeSchema(tmpDir, "broken", "module.exports = 7;");

  assert.throws(
    () => installLayerSchemas(createDbSpy(), { layers: [broken] }),
    /Invalid schema module in layer "broken"/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a failing installer reports which layer failed", () => {
  const tmpDir = createTempDir();
  const broken = writeSchema(
    tmpDir,
    "exploding",
    "module.exports = { install(){ throw new Error('no such table: tickets'); } };"
  );

  assert.throws(
    () => installLayerSchemas(createDbSpy(), { layers: [broken] }),
    /Schema installation failed in layer "exploding".*no such table: tickets/s
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("installers run again on a second call without erroring", () => {
  const tmpDir = createTempDir();
  const layer = writeSchema(
    tmpDir,
    "idempotent",
    "module.exports = { install(db){ db.statements.push('run'); } };"
  );

  const db = createDbSpy();
  installLayerSchemas(db, { layers: [layer] });
  installLayerSchemas(db, { layers: [layer] });

  // Installers are expected to be idempotent (CREATE TABLE IF NOT EXISTS);
  // core simply invokes them on every boot.
  assert.deepEqual(db.statements, ["run", "run"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
