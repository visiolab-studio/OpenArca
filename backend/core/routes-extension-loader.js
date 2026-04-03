const fs = require("fs");
const { extensionsRoutesFile } = require("../config");

const DEFAULT_ROUTES_FILE = extensionsRoutesFile;

function loadRoutesRegistrar(routesFilePath = DEFAULT_ROUTES_FILE) {
  if (!routesFilePath || !fs.existsSync(routesFilePath)) {
    return null;
  }

  const resolvedPath = require.resolve(routesFilePath);
  delete require.cache[resolvedPath];
  const loaded = require(routesFilePath);

  if (typeof loaded === "function") {
    return loaded;
  }

  if (loaded && typeof loaded.register === "function") {
    return loaded.register;
  }

  throw new Error("Invalid enterprise routes module: expected function or { register }");
}

function registerRoutesExtensions(app, options = {}) {
  const registrar =
    Object.prototype.hasOwnProperty.call(options, "registrar") && options.registrar
      ? options.registrar
      : loadRoutesRegistrar(options.routesFilePath);

  if (!registrar) {
    return false;
  }

  registrar({
    app,
    ...(options.context || {})
  });

  return true;
}

module.exports = {
  loadRoutesRegistrar,
  registerRoutesExtensions
};
