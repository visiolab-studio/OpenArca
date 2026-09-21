const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createServiceRegistry, SERVICE_NAMES } = require("../core/extension-registry");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openarca-registry-layers-"));
}

function writeOverrides(tmpDir, layerName, source) {
  const filePath = path.join(tmpDir, `${layerName}-service-overrides.js`);
  fs.writeFileSync(filePath, source, "utf8");
  return { name: layerName, overridesFile: filePath };
}

test("an upper layer receives the service as composed by the layer below it", () => {
  const tmpDir = createTempDir();

  const enterprise = writeOverrides(
    tmpDir,
    "enterprise",
    "module.exports = { workflowService(current){ return { ...current, trail: ['enterprise'] }; } };"
  );
  const edudoro = writeOverrides(
    tmpDir,
    "edudoro",
    "module.exports = { workflowService(current){ return { ...current, trail: [...current.trail, 'edudoro'] }; } };"
  );

  const registry = createServiceRegistry({ layers: [enterprise, edudoro] });
  const workflowService = registry.getService("workflowService");

  // The decorator chain proves the upper layer saw the lower layer's version,
  // not the pristine core service.
  assert.deepEqual(workflowService.trail, ["enterprise", "edudoro"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a layer can register a service name core does not know", () => {
  const tmpDir = createTempDir();
  const edudoro = writeOverrides(
    tmpDir,
    "edudoro",
    "module.exports = { billingService: { resolveRecordUrl(){ return 'https://example.test/record'; } } };"
  );

  const registry = createServiceRegistry({ layers: [edudoro] });
  const billingService = registry.getService("billingService");

  assert.equal(billingService.resolveRecordUrl(), "https://example.test/record");
  assert.ok(registry.listServices().includes("billingService"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("object overrides merge over the composed service across layers", () => {
  const tmpDir = createTempDir();

  const enterprise = writeOverrides(
    tmpDir,
    "enterprise",
    "module.exports = { ticketService: { provider: 'enterprise', enterpriseOnly: true } };"
  );
  const edudoro = writeOverrides(
    tmpDir,
    "edudoro",
    "module.exports = { ticketService: { provider: 'edudoro' } };"
  );

  const registry = createServiceRegistry({ layers: [enterprise, edudoro] });
  const ticketService = registry.getService("ticketService");

  assert.equal(ticketService.provider, "edudoro");
  assert.equal(ticketService.enterpriseOnly, true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("an invalid override names the offending layer", () => {
  const tmpDir = createTempDir();
  const broken = writeOverrides(
    tmpDir,
    "broken",
    "module.exports = { workflowService(){ return 'not-an-object'; } };"
  );

  assert.throws(
    () => createServiceRegistry({ layers: [broken] }),
    /Invalid override for workflowService \(layer "broken"\): function must return object/
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("with no layers the core services resolve unchanged", () => {
  const registry = createServiceRegistry({ layers: [] , overrides: {} });

  assert.deepEqual(registry.listServices(), SERVICE_NAMES);
  assert.equal(registry.getService("workflowService").provider, "core");
});

test("unknown service still throws the original message", () => {
  const registry = createServiceRegistry({ overrides: {} });

  assert.throws(() => registry.getService("nopeService"), /Unknown service: nopeService/);
});

test("a layer with no overrides file contributes nothing", () => {
  const tmpDir = createTempDir();
  const missing = { name: "empty", overridesFile: path.join(tmpDir, "absent.js") };
  const enterprise = writeOverrides(
    tmpDir,
    "enterprise",
    "module.exports = { workflowService: { provider: 'enterprise' } };"
  );

  const registry = createServiceRegistry({ layers: [missing, enterprise] });

  assert.equal(registry.getService("workflowService").provider, "enterprise");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
