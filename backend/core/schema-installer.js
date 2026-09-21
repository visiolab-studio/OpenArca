const fs = require("fs");
const { extensionLayers } = require("../config");

// Layer schemas install from the lowest layer upward, after core's own tables.
// Ordering is load-bearing rather than cosmetic: layer tables carry foreign keys
// INTO lower layers, so a table can only be created once everything it
// references exists.
//
// This must also run before ANY route registrar, because route registrars run in
// reverse layer order (see routes-extension-loader). A higher layer's registrar
// can therefore execute before a lower layer's, and it must still find the lower
// layer's tables in place.
//
// See docs/extensions/layer-contract.md.

function parseSchemaModule(loaded, originLabel) {
  if (typeof loaded === "function") {
    return loaded;
  }

  if (loaded && typeof loaded.install === "function") {
    return loaded.install;
  }

  throw new Error(`Invalid schema module${originLabel}: expected function or { install }`);
}

function installLayerSchemas(db, options = {}) {
  const layers = options.layers || extensionLayers || [];
  const installed = [];

  for (const layer of layers) {
    if (!layer.schemaFile || !fs.existsSync(layer.schemaFile)) {
      continue;
    }

    const originLabel = ` in layer "${layer.name}" (${layer.schemaFile})`;
    const resolvedPath = require.resolve(layer.schemaFile);
    delete require.cache[resolvedPath];
    const install = parseSchemaModule(require(layer.schemaFile), originLabel);

    try {
      install(db);
    } catch (error) {
      throw new Error(`Schema installation failed${originLabel}: ${error.message}`);
    }

    installed.push(layer.name);
  }

  return installed;
}

module.exports = { installLayerSchemas };
