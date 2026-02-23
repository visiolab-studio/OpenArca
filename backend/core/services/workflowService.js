function createWorkflowService() {
  return {
    provider: "core",
    buildEnterpriseCheckPayload(featureKey) {
      return {
        ok: true,
        checked_feature: String(featureKey || ""),
        generated_at: new Date().toISOString()
      };
    }
  };
}

module.exports = {
  createWorkflowService
};
