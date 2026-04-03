import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appNodeModules = path.resolve(__dirname, "node_modules");
const localEnterpriseFrontendModule = path.resolve(
  __dirname,
  "../../OpenArca-Enterprise/frontend/extensions/index.jsx"
);
const enterpriseFrontendModule =
  process.env.ENTERPRISE_FRONTEND_MODULE && fs.existsSync(process.env.ENTERPRISE_FRONTEND_MODULE)
    ? process.env.ENTERPRISE_FRONTEND_MODULE
    : fs.existsSync(localEnterpriseFrontendModule)
      ? localEnterpriseFrontendModule
      : path.resolve(__dirname, "./src/enterprise/extensions.stub.jsx");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "virtual:enterprise-frontend": enterpriseFrontendModule,
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
      allow: [path.resolve(__dirname, ".."), path.dirname(enterpriseFrontendModule)]
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js"
  }
});
