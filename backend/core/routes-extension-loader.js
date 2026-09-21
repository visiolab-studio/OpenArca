const fs = require("fs");
const { extensionsRoutesFile, extensionLayers } = require("../config");
const { inRouteOrder } = require("./layer-resolver");

// Express matches routes first-registered-wins. Route registrars therefore run
// in REVERSE layer order, so the topmost layer wins a path conflict instead of
// being permanently shadowed by the layer below it. Middleware wants the other
// direction and runs in forward order, so a lower layer's concern encloses the
// higher layer's handlers. See docs/extensions/layer-contract.md.

const DEFAULT_ROUTES_FILE = extensionsRoutesFile;

function requireFresh(modulePath) {
  const resolvedPath = require.resolve(modulePath);
  delete require.cache[resolvedPath];
  return require(modulePath);
}

// Returns { register, registerMiddleware } — either may be null. A bare function
// export, or `{ register }` alone, is treated as routes only. That is what the
// existing Enterprise layer ships, so it must keep working untouched.
function parseRoutesModule(loaded, originLabel) {
  if (typeof loaded === "function") {
    return { register: loaded, registerMiddleware: null };
  }

  if (loaded && typeof loaded === "object") {
    const register = typeof loaded.register === "function" ? loaded.register : null;
    const registerMiddleware =
      typeof loaded.registerMiddleware === "function" ? loaded.registerMiddleware : null;

    if (register || registerMiddleware) {
      return { register, registerMiddleware };
    }
  }

  throw new Error(
    `Invalid routes module${originLabel}: expected function, { register } or { registerMiddleware }`
  );
}

function loadRoutesRegistrar(routesFilePath = DEFAULT_ROUTES_FILE) {
  if (!routesFilePath || !fs.existsSync(routesFilePath)) {
    return null;
  }

  const loaded = requireFresh(routesFilePath);

  if (typeof loaded === "function") {
    return loaded;
  }

  if (loaded && typeof loaded.register === "function") {
    return loaded.register;
  }

  throw new Error("Invalid enterprise routes module: expected function or { register }");
}

// With several layers loaded, an anonymous load error is close to undebuggable,
// so every failure names the layer it came from.
function loadLayerRegistrars(layers) {
  return layers
    .filter((layer) => layer.routesFile && fs.existsSync(layer.routesFile))
    .map((layer) => {
      const originLabel = ` in layer "${layer.name}" (${layer.routesFile})`;
      const loaded = requireFresh(layer.routesFile);
      return { ...parseRoutesModule(loaded, originLabel), layerName: layer.name };
    });
}

function resolveEntries(options) {
  if (Object.prototype.hasOwnProperty.call(options, "registrar") && options.registrar) {
    return [{ register: options.registrar, registerMiddleware: null, layerName: null }];
  }

  if (options.routesFilePath) {
    const registrar = loadRoutesRegistrar(options.routesFilePath);
    return registrar ? [{ register: registrar, registerMiddleware: null, layerName: null }] : [];
  }

  const layers = options.layers || extensionLayers || [];
  if (layers.length > 0) {
    return loadLayerRegistrars(layers);
  }

  const registrar = loadRoutesRegistrar(DEFAULT_ROUTES_FILE);
  return registrar ? [{ register: registrar, registerMiddleware: null, layerName: null }] : [];
}

function registerRoutesExtensions(app, options = {}) {
  const entries = resolveEntries(options);

  if (entries.length === 0) {
    return false;
  }

  const context = { app, ...(options.context || {}) };

  for (const entry of entries) {
    if (entry.registerMiddleware) {
      entry.registerMiddleware(context);
    }
  }

  for (const entry of inRouteOrder(entries)) {
    if (entry.register) {
      entry.register(context);
    }
  }

  return true;
}

module.exports = {
  loadRoutesRegistrar,
  loadLayerRegistrars,
  registerRoutesExtensions
};
