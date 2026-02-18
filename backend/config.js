const path = require("path");

const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, "data");
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(ROOT_DIR, "uploads");

module.exports = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "change-me-in-env",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
  dataDir: DATA_DIR,
  uploadsDir: UPLOADS_DIR,
  sqlitePath: process.env.SQLITE_PATH || path.join(DATA_DIR, "data.sqlite")
};
