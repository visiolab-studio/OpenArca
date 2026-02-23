const { getCapabilities } = require("../services/capabilities");

function requireFeature(featureKey) {
  return (req, res, next) => {
    const key = String(featureKey || "").trim();
    if (!key) {
      return res.status(500).json({ error: "feature_key_missing" });
    }

    const { capabilities } = getCapabilities();
    if (!capabilities || capabilities[key] !== true) {
      return res.status(403).json({ error: "feature_not_enabled", feature: key });
    }

    return next();
  };
}

module.exports = {
  requireFeature
};
