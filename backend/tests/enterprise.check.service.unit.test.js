const test = require("node:test");
const assert = require("node:assert/strict");
const { createEnterpriseCheckService } = require("../services/enterpriseCheck");

test("enterprise check service builds payload using workflow service", () => {
  const service = createEnterpriseCheckService({
    getWorkflowService() {
      return {
        buildEnterpriseCheckPayload(featureKey) {
          return {
            ok: true,
            checked_feature: featureKey,
            source: "mock"
          };
        }
      };
    }
  });

  const payload = service.buildPayload("enterprise_automation");
  assert.equal(payload.ok, true);
  assert.equal(payload.checked_feature, "enterprise_automation");
  assert.equal(payload.source, "mock");
});

test("enterprise check service requires feature key", () => {
  const service = createEnterpriseCheckService({
    getWorkflowService() {
      return {
        buildEnterpriseCheckPayload() {
          return { ok: true };
        }
      };
    }
  });

  assert.throws(() => {
    service.buildPayload("");
  }, /feature_key_required/);
});

test("enterprise check service validates workflow service contract", () => {
  const service = createEnterpriseCheckService({
    getWorkflowService() {
      return {};
    }
  });

  assert.throws(() => {
    service.buildPayload("enterprise_automation");
  }, /workflow_service_invalid/);
});
