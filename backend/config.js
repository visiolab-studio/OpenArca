const path = require("path");

const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, "data");
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(ROOT_DIR, "uploads");
const EXTENSIONS_DIR = process.env.EXTENSIONS_DIR || path.join(ROOT_DIR, "extensions");

function toBoolean(inputValue, fallback = false) {
  const normalized = String(inputValue == null ? "" : inputValue).trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

function toPositiveInt(inputValue, fallback) {
  const numeric = Number(inputValue);
  if (!Number.isFinite(numeric)) return fallback;
  const normalized = Math.floor(numeric);
  if (normalized <= 0) return fallback;
  return normalized;
}

function toNonNegativeInt(inputValue, fallback) {
  const numeric = Number(inputValue);
  if (!Number.isFinite(numeric)) return fallback;
  const normalized = Math.floor(numeric);
  if (normalized < 0) return fallback;
  return normalized;
}

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
  extensionsOverridesFile: EXTENSIONS_OVERRIDES_FILE,
  outboxWorkerEnabled: toBoolean(process.env.OUTBOX_WORKER_ENABLED, false),
  outboxWorkerPollMs: toPositiveInt(process.env.OUTBOX_WORKER_POLL_MS, 5000),
  outboxWorkerBatchSize: toPositiveInt(process.env.OUTBOX_WORKER_BATCH_SIZE, 20),
  outboxWorkerMaxAttempts: toPositiveInt(process.env.OUTBOX_WORKER_MAX_ATTEMPTS, 5),
  outboxWorkerProcessingTimeoutMs: toPositiveInt(
    process.env.OUTBOX_WORKER_PROCESSING_TIMEOUT_MS,
    300000
  ),
  outboxWorkerRetryBaseMs: toPositiveInt(process.env.OUTBOX_WORKER_RETRY_BASE_MS, 10000),
  outboxWorkerRetryMaxMs: toPositiveInt(process.env.OUTBOX_WORKER_RETRY_MAX_MS, 300000),
  outboxWorkerAlertPendingThreshold: toNonNegativeInt(
    process.env.OUTBOX_WORKER_ALERT_PENDING_THRESHOLD,
    100
  ),
  outboxWorkerAlertOldestPendingAgeSeconds: toNonNegativeInt(
    process.env.OUTBOX_WORKER_ALERT_OLDEST_PENDING_AGE_SECONDS,
    900
  ),
  outboxWorkerAlertStuckProcessingThreshold: toNonNegativeInt(
    process.env.OUTBOX_WORKER_ALERT_STUCK_PROCESSING_THRESHOLD,
    1
  ),
  outboxWorkerAlertFailedThreshold: toNonNegativeInt(
    process.env.OUTBOX_WORKER_ALERT_FAILED_THRESHOLD,
    1
  )
};
