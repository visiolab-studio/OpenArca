const fs = require("fs");
const path = require("path");

// Resolves the ordered extension layer stack.
//
// See docs/extensions/layer-contract.md. Consumers: extension-registry (service
// overrides), routes-extension-loader (route registrars), schema installation
// and the admin readiness view. The frontend needs the same ordering but cannot
// use this module — vite.config.js is ESM running outside the backend process —
// so the parsing rules are documented in the contract rather than only here.

const ENTRY_FILES = {
  overridesFile: ["backend", "extensions", "service-overrides.js"],
  routesFile: ["backend", "extensions", "routes.js"],
  schemaFile: ["backend", "extensions", "schema.js"],
  frontendModule: ["frontend", "extensions", "index.jsx"]
};

const MANIFEST_FILE = "layer.json";

function toAbsolutePath(baseDir, inputPath) {
  if (!inputPath) return "";
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(baseDir, inputPath);
}

function parseLayerList(rawValue) {
  if (typeof rawValue !== "string") return [];
  return rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readManifest(layerRoot) {
  const manifestPath = path.join(layerRoot, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    return { name: path.basename(layerRoot), requires: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid ${MANIFEST_FILE} in layer "${layerRoot}": ${error.message}`);
  }

  const name =
    typeof parsed.name === "string" && parsed.name.trim()
      ? parsed.name.trim()
      : path.basename(layerRoot);

  const requires = Array.isArray(parsed.requires)
    ? parsed.requires.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())
    : [];

  return { name, requires };
}

function resolveEntryFiles(layerRoot) {
  const entries = {};
  for (const [key, segments] of Object.entries(ENTRY_FILES)) {
    const candidate = path.join(layerRoot, ...segments);
    entries[key] = fs.existsSync(candidate) ? candidate : "";
  }
  return entries;
}

// A layer root that does not exist is a boot failure rather than a silent skip.
// The single-slot loaders this replaces skipped missing files quietly, which
// meant a typo in a path presented as "the feature mysteriously isn't there".
function buildConfiguredLayers(rawValue, rootDir) {
  return parseLayerList(rawValue).map((entry) => {
    const layerRoot = toAbsolutePath(rootDir, entry);

    if (!fs.existsSync(layerRoot)) {
      throw new Error(
        `Extension layer path does not exist: "${entry}" (resolved to "${layerRoot}"). ` +
          `Check EXTENSIONS_LAYERS.`
      );
    }

    const manifest = readManifest(layerRoot);

    return {
      name: manifest.name,
      requires: manifest.requires,
      root: layerRoot,
      source: "EXTENSIONS_LAYERS",
      ...resolveEntryFiles(layerRoot)
    };
  });
}

// Backward compatibility: EXTENSIONS_DIR / EXTENSIONS_OVERRIDES_FILE /
// EXTENSIONS_ROUTES_FILE describe one implicit layer. Missing files stay a
// silent skip here — that is the behaviour existing deployments rely on.
function buildLegacyLayer(env, rootDir, defaults) {
  const extensionsDir = toAbsolutePath(rootDir, env.EXTENSIONS_DIR || defaults.extensionsDir);
  const overridesFile = toAbsolutePath(
    rootDir,
    env.EXTENSIONS_OVERRIDES_FILE || path.join(extensionsDir, "service-overrides.js")
  );
  const routesFile = toAbsolutePath(
    rootDir,
    env.EXTENSIONS_ROUTES_FILE || path.join(extensionsDir, "routes.js")
  );
  const schemaFile = path.join(extensionsDir, "schema.js");

  return {
    name: "default",
    requires: [],
    root: extensionsDir,
    source: "legacy",
    overridesFile: fs.existsSync(overridesFile) ? overridesFile : "",
    routesFile: fs.existsSync(routesFile) ? routesFile : "",
    schemaFile: fs.existsSync(schemaFile) ? schemaFile : "",
    frontendModule: ""
  };
}

function hasExplicitLegacyConfig(env) {
  return Boolean(env.EXTENSIONS_DIR || env.EXTENSIONS_OVERRIDES_FILE || env.EXTENSIONS_ROUTES_FILE);
}

// A prerequisite must be satisfied by a layer BELOW the declaring one. Declaring
// a layer that exists higher up would mean depending on something loaded after
// you, which the composition order cannot honour.
function validatePrerequisites(layers) {
  layers.forEach((layer, index) => {
    for (const required of layer.requires) {
      const satisfied = layers.slice(0, index).some((candidate) => candidate.name === required);
      if (satisfied) continue;

      const loaded = ["core", ...layers.map((entry) => entry.name)].join(", ");
      throw new Error(
        `Layer "${layer.name}" requires layer "${required}", which is not loaded below it. ` +
          `Configured layers: ${loaded}`
      );
    }
  });
}

function resolveLayers(options = {}) {
  const env = options.env || process.env;
  const rootDir = options.rootDir;
  const defaults = options.defaults || {};
  const warnings = [];

  const configured = parseLayerList(env.EXTENSIONS_LAYERS);

  let layers;
  if (configured.length > 0) {
    if (hasExplicitLegacyConfig(env)) {
      warnings.push(
        "EXTENSIONS_LAYERS is set, so EXTENSIONS_DIR / EXTENSIONS_OVERRIDES_FILE / " +
          "EXTENSIONS_ROUTES_FILE are ignored. Honouring both would produce a load " +
          "order that cannot be read off the configuration."
      );
    }
    layers = buildConfiguredLayers(env.EXTENSIONS_LAYERS, rootDir);
  } else {
    if (hasExplicitLegacyConfig(env)) {
      warnings.push(
        "EXTENSIONS_DIR / EXTENSIONS_OVERRIDES_FILE / EXTENSIONS_ROUTES_FILE are " +
          "deprecated. Use EXTENSIONS_LAYERS, which supports several stacked layers."
      );
    }
    layers = [buildLegacyLayer(env, rootDir, defaults)];
  }

  validatePrerequisites(layers);

  return { layers, warnings };
}

// Routes register topmost-first so the highest layer wins an Express path
// conflict; everything else composes lowest-first. See the contract for why.
function inRouteOrder(layers) {
  return [...layers].reverse();
}

module.exports = {
  ENTRY_FILES,
  MANIFEST_FILE,
  parseLayerList,
  readManifest,
  resolveLayers,
  inRouteOrder,
  validatePrerequisites
};
