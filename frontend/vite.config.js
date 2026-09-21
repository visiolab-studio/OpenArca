import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appNodeModules = path.resolve(__dirname, "node_modules");
const repoRoot = path.resolve(__dirname, "..");

// Vite runs outside the backend process and cannot require the CommonJS layer
// resolver, so this is the second, deliberately minimal implementation of the
// same parsing rules. Both are governed by docs/extensions/layer-contract.md —
// relative layer roots resolve against the REPOSITORY root in both.
const VIRTUAL_ID = "virtual:openarca-extensions";
const LEGACY_VIRTUAL_ID = "virtual:enterprise-frontend";
const RESOLVED_VIRTUAL_ID = "\0virtual:openarca-extensions";

const legacyLocalModule = path.resolve(
  __dirname,
  "../../OpenArca-Enterprise/frontend/extensions/index.jsx"
);

function parseLayerList(rawValue) {
  if (typeof rawValue !== "string") return [];
  return rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveLayerFrontendModules() {
  const configured = parseLayerList(process.env.EXTENSIONS_LAYERS);

  if (configured.length > 0) {
    return configured
      .map((entry) => (path.isAbsolute(entry) ? entry : path.resolve(repoRoot, entry)))
      .map((layerRoot) => path.join(layerRoot, "frontend", "extensions", "index.jsx"))
      .filter((modulePath) => fs.existsSync(modulePath));
  }

  // Legacy single-slot behaviour, unchanged.
  if (
    process.env.ENTERPRISE_FRONTEND_MODULE &&
    fs.existsSync(process.env.ENTERPRISE_FRONTEND_MODULE)
  ) {
    return [process.env.ENTERPRISE_FRONTEND_MODULE];
  }

  return fs.existsSync(legacyLocalModule) ? [legacyLocalModule] : [];
}

const layerFrontendModules = resolveLayerFrontendModules();

const SLOT_NAMES = [
  "enterpriseBaseItems",
  "enterpriseNavSections",
  "enterpriseRoutes",
  "enterpriseProfileNotificationSections",
  // Sections rendered on the ticket detail page. A layer contributing here gets
  // the ticket and renders its own card; core does not know what it draws.
  "ticketDetailSections"
];

// Generates an aggregator module importing every layer's entry and merging the
// slots. With no layers the generated module exports empty arrays, so a
// core-only build compiles and renders no extension UI.
function openarcaExtensionsPlugin() {
  return {
    name: "openarca-extensions",
    resolveId(id) {
      if (id === VIRTUAL_ID || id === LEGACY_VIRTUAL_ID) {
        return RESOLVED_VIRTUAL_ID;
      }
      return null;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;

      const mergeSlotsPath = path.resolve(__dirname, "./src/enterprise/merge-slots.js");
      const imports = layerFrontendModules
        .map((modulePath, index) => `import * as layer${index} from ${JSON.stringify(modulePath)};`)
        .join("\n");
      const layerList = layerFrontendModules.map((_, index) => `layer${index}`).join(", ");
      const slotExports = SLOT_NAMES.map(
        (slotName) =>
          `export const ${slotName} = mergeSlot(layers, ${JSON.stringify(slotName)});`
      ).join("\n");

      return [
        `import { mergeSlot } from ${JSON.stringify(mergeSlotsPath)};`,
        imports,
        `const layers = [${layerList}];`,
        slotExports,
        `export default { ${SLOT_NAMES.join(", ")} };`
      ]
        .filter(Boolean)
        .join("\n");
    }
  };
}

export default defineConfig({
  plugins: [react(), openarcaExtensionsPlugin()],
  resolve: {
    alias: {
      react: path.resolve(appNodeModules, "react"),
      "react-dom": path.resolve(appNodeModules, "react-dom"),
      "react-router": path.resolve(appNodeModules, "react-router"),
      "react-router-dom": path.resolve(appNodeModules, "react-router-dom"),
      "react/jsx-runtime": path.resolve(appNodeModules, "react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(appNodeModules, "react/jsx-dev-runtime.js"),
      "react-i18next": path.resolve(appNodeModules, "react-i18next"),
      "lucide-react": path.resolve(appNodeModules, "lucide-react")
    }
  },
  server: {
    fs: {
      // Every configured layer root must be readable, not just one.
      allow: [repoRoot, ...layerFrontendModules.map((modulePath) => path.dirname(modulePath))]
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js"
  }
});
