const fs = require("fs");
const { extensionLayers, extensionLayerWarnings } = require("../config");

// With one extension bundle, a seam that contributes nothing is an inconvenience.
// With several stacked layers it becomes the most common operational question —
// "why is this route not responding?" — so the resolved stack is reported rather
// than left to be inferred from behaviour.
//
// A layer that cannot be loaded at all aborts the boot (see layer-resolver), so
// what this surfaces is the quieter failure: a layer that loaded but contributes
// no seam, usually a misplaced entry file.
//
// See docs/extensions/layer-contract.md.

const SEAM_FIELDS = [
  ["services", "overridesFile"],
  ["routes", "routesFile"],
  ["schema", "schemaFile"],
  ["frontend", "frontendModule"]
];

function describeLayer(layer) {
  const seams = [];
  const missing = [];

  for (const [seamName, field] of SEAM_FIELDS) {
    const filePath = layer[field];
    if (filePath && fs.existsSync(filePath)) {
      seams.push(seamName);
    } else {
      missing.push(seamName);
    }
  }

  return {
    name: layer.name,
    path: layer.root || "",
    source: layer.source || "EXTENSIONS_LAYERS",
    requires: layer.requires || [],
    seams,
    missing_seams: missing,
    status: seams.length > 0 ? "loaded" : "contributes_nothing"
  };
}

function getLayerDiagnostics(options = {}) {
  const layers = options.layers || extensionLayers || [];
  const warnings = options.warnings || extensionLayerWarnings || [];

  // Core is always the bottom layer. Listing it keeps a core-only install
  // readable as one row rather than an empty table.
  const rows = [
    {
      name: "core",
      path: "",
      source: "core",
      requires: [],
      seams: ["services", "routes", "schema", "frontend"],
      missing_seams: [],
      status: "loaded"
    },
    ...layers.map(describeLayer)
  ];

  return {
    count: rows.length,
    layers: rows,
    warnings,
    status: rows.some((row) => row.status === "contributes_nothing")
      ? "needs_attention"
      : "ready"
  };
}

module.exports = { getLayerDiagnostics, describeLayer };
