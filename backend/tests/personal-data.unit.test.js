const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadLayerHandlers } = require("../core/personal-data");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openarca-personal-data-"));
}

function writeLayer(tmpDir, name, source) {
  const root = path.join(tmpDir, name);
  fs.mkdirSync(path.join(root, "backend", "extensions"), { recursive: true });
  if (source !== null) {
    fs.writeFileSync(path.join(root, "backend", "extensions", "personal-data.js"), source, "utf8");
  }
  return { name, root };
}

test("a layer declaring a personal-data surface is picked up", () => {
  const tmpDir = createTempDir();
  const layer = writeLayer(
    tmpDir,
    "enterprise",
    "module.exports = { export(){ return { rows: 1 }; }, erase(){ return { erased: 1 }; } };"
  );

  const handlers = loadLayerHandlers([layer]);

  assert.equal(handlers.length, 1);
  assert.equal(handlers[0].name, "enterprise");
  assert.deepEqual(handlers[0].handlers.export(), { rows: 1 });

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a layer declaring nothing is skipped cleanly", () => {
  const tmpDir = createTempDir();
  const silent = writeLayer(tmpDir, "quiet", null);
  const speaking = writeLayer(tmpDir, "loud", "module.exports = { export(){ return {}; } };");

  const handlers = loadLayerHandlers([silent, speaking]);

  // Most layers hold no personal data; requiring every one to declare an empty
  // module would be ceremony that nobody keeps up to date.
  assert.deepEqual(handlers.map((entry) => entry.name), ["loud"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("declaring only one half is allowed", () => {
  const tmpDir = createTempDir();
  const exportOnly = writeLayer(tmpDir, "reader", "module.exports = { export(){ return {}; } };");
  const eraseOnly = writeLayer(tmpDir, "eraser", "module.exports = { erase(){ return {}; } };");

  assert.equal(loadLayerHandlers([exportOnly, eraseOnly]).length, 2);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a malformed module names the layer it came from", () => {
  const tmpDir = createTempDir();
  const broken = writeLayer(tmpDir, "broken", "module.exports = { nothing: true };");

  assert.throws(
    () => loadLayerHandlers([broken]),
    /Invalid personal-data module in layer "broken"/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("layers are returned in load order", () => {
  const tmpDir = createTempDir();
  const first = writeLayer(tmpDir, "aaa", "module.exports = { erase(){ return {}; } };");
  const second = writeLayer(tmpDir, "bbb", "module.exports = { erase(){ return {}; } };");

  // Erasure runs in this order, and it matters: layer tables carry foreign keys
  // into core, so they must clear themselves before core touches the user row.
  assert.deepEqual(
    loadLayerHandlers([first, second]).map((entry) => entry.name),
    ["aaa", "bbb"]
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
