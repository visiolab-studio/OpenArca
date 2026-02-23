const path = require("path");

const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, "data");
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(ROOT_DIR, "uploads");
const EXTENSIONS_DIR = process.env.EXTENSIONS_DIR || path.join(ROOT_DIR, "extensions");

function toAbsolutePath(baseDir, inputPath) {
  if (!inputPath) return "";
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(baseDir, inputPath);
}

const EXTENSIONS_OVERRIDES_FILE = toAbsolutePath(
  ROOT_DIR,
  process.env.EXTENSIONS_OVERRIDES_FILE || path.join(EXTENSIONS_DIR, "service-overrides.js")
);

module.exports = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "change-me-in-env",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
  dataDir: DATA_DIR,
  uploadsDir: UPLOADS_DIR,
  sqlitePath: process.env.SQLITE_PATH || path.join(DATA_DIR, "data.sqlite"),
  extensionsDir: toAbsolutePath(ROOT_DIR, EXTENSIONS_DIR),
  extensionsOverridesFile: EXTENSIONS_OVERRIDES_FILE
};
