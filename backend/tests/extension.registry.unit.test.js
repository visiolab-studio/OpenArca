const test = require("node:test");
const assert = require("node:assert/strict");
const { createServiceRegistry, SERVICE_NAMES } = require("../core/extension-registry");

test("extension registry exposes known service names", () => {
  const registry = createServiceRegistry({ overrides: {} });
  assert.deepEqual(registry.listServices(), SERVICE_NAMES);
});

test("extension registry returns core services by default", () => {
  const registry = createServiceRegistry({ overrides: {} });
  const workflowService = registry.getService("workflowService");

  assert.equal(workflowService.provider, "core");
  const payload = workflowService.buildEnterpriseCheckPayload("enterprise_automation");
  assert.equal(payload.ok, true);
  assert.equal(payload.checked_feature, "enterprise_automation");
  assert.equal(typeof payload.generated_at, "string");
});

test("extension registry supports function overrides", () => {
  const registry = createServiceRegistry({
    overrides: {
      workflowService(coreService) {
        return {
          ...coreService,
          provider: "enterprise",
          buildEnterpriseCheckPayload(featureKey) {
            return {
              ...coreService.buildEnterpriseCheckPayload(featureKey),
              source: "override"
            };
          }
        };
      }
    }
  });

  const workflowService = registry.getService("workflowService");
  assert.equal(workflowService.provider, "enterprise");

  const payload = workflowService.buildEnterpriseCheckPayload("enterprise_automation");
  assert.equal(payload.source, "override");
});

test("extension registry supports object overrides", () => {
  const registry = createServiceRegistry({
    overrides: {
      workflowService: {
        provider: "object-override"
      }
    }
  });

  const workflowService = registry.getService("workflowService");
  assert.equal(workflowService.provider, "object-override");
});

test("extension registry rejects invalid overrides", () => {
  assert.throws(() => {
    createServiceRegistry({
      overrides: {
        workflowService: 123
      }
    });
  }, /Invalid override/);
});
