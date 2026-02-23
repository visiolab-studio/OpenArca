const { getService } = require("../core/extension-registry");

function createEnterpriseCheckService(options = {}) {
  const getWorkflowService =
    options.getWorkflowService ||
    (() => {
      return getService("workflowService");
    });

  return {
    buildPayload(featureKey) {
      const normalizedFeature = String(featureKey || "").trim();
      if (!normalizedFeature) {
        throw new Error("feature_key_required");
      }

      const workflowService = getWorkflowService();
      if (!workflowService || typeof workflowService.buildEnterpriseCheckPayload !== "function") {
        throw new Error("workflow_service_invalid");
      }

      return workflowService.buildEnterpriseCheckPayload(normalizedFeature);
    }
  };
}

const enterpriseCheckService = createEnterpriseCheckService();

module.exports = {
  createEnterpriseCheckService,
  enterpriseCheckService
};
