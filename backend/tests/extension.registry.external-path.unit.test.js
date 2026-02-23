const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createServiceRegistry } = require("../core/extension-registry");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openarca-ext-registry-"));
}

test("extension registry loads override from external overrides file path", () => {
  const tmpDir = createTempDir();
  const overridesFile = path.join(tmpDir, "service-overrides.js");

  fs.writeFileSync(
    overridesFile,
    "module.exports = { workflowService(core){ return { ...core, provider: 'enterprise-file' }; } };",
    "utf8"
  );

  const registry = createServiceRegistry({ overridesFilePath: overridesFile });
  const workflowService = registry.getService("workflowService");

  assert.equal(workflowService.provider, "enterprise-file");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extension registry keeps core fallback when external overrides file is missing", () => {
  const tmpDir = createTempDir();
  const overridesFile = path.join(tmpDir, "missing-overrides.js");

  const registry = createServiceRegistry({ overridesFilePath: overridesFile });
  const workflowService = registry.getService("workflowService");

  assert.equal(workflowService.provider, "core");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
