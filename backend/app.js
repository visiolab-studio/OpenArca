require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { frontendOrigin, uploadsDir, dataDir, sqlitePath, appUrl, allowedOrigins, canonicalOrigin } = require("./config");
const { resolveRequestOrigin } = require("./core/hosts");
const db = require("./db");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const devTaskRoutes = require("./routes/devTasks");
const projectRoutes = require("./routes/projects");
const ticketTemplateRoutes = require("./routes/ticketTemplates");
const userRoutes = require("./routes/users");
const settingsRoutes = require("./routes/settings");
const publicRoutes = require("./routes/public");
const serviceAccountRoutes = require("./routes/service-accounts");
const { authRequired } = require("./middleware/auth");
const { requireRole } = require("./middleware/auth");
const { requireScope } = require("./middleware/auth");
const { requireFeature } = require("./middleware/features");
const { writeLimiter } = require("./middleware/rate-limiters");
const { upload } = require("./middleware/uploads");
const { notFound, errorHandler } = require("./middleware/error-handler");
const { sendEmail } = require("./services/email");
const { getService } = require("./core/extension-registry");
const { registerRoutesExtensions } = require("./core/routes-extension-loader");
const { installLayerSchemas } = require("./core/schema-installer");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

// Core tables exist by now (require("./db") ran the core migration). Layer
// schemas install lowest-first, and before any route registrar: registrars run
// in reverse layer order, so a higher layer's routes can execute first and must
// still find the lower layer's tables in place.
installLayerSchemas(db);

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use(
  cors({
    // Every allowed host, and nothing else. A single-host install resolves to a
    // one-entry list, so this is unchanged for them.
    origin: allowedOrigins.length > 0 ? allowedOrigins : frontendOrigin,
    credentials: false,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Resolved once per request from the allowlist. Handlers must use this rather
// than reading Host themselves, which is what makes the rule enforceable.
app.use((req, _res, next) => {
  req.resolvedOrigin = resolveRequestOrigin(req, allowedOrigins, { canonical: canonicalOrigin });
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.get("/health", (req, res) => {
  return res.json({
    service: "backend",
    status: "ok",
    sqlite_path: sqlitePath,
    time: new Date().toISOString()
  });
});

// BEFORE core's own routes, so the layer ordering means what the contract says:
// registrars run topmost-layer-first, then core, and Express matches
// first-registered-wins. Mounting core first would have made a layer unable to
// override any core route — only to add new ones.
registerRoutesExtensions(app, {
  context: {
    express,
    db,
    appUrl,
    uploadsDir,
    getService,
    sendEmail,
    middlewares: {
      authRequired,
      requireRole,
      requireScope,
      requireFeature,
      writeLimiter,
      upload
    }
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/dev-tasks", devTaskRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/ticket-templates", ticketTemplateRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/service-accounts", serviceAccountRoutes);

// Unauthenticated by design. Mounted last among core routes so nothing above it
// can be reached without a session by accident.
app.use("/api/public", publicRoutes);



app.get("/api/uploads/:filename", authRequired, (req, res) => {
  const filename = String(req.params.filename || "");
  if (!/^[a-z0-9-]+(\.[a-z0-9]+)?$/i.test(filename)) {
    return res.status(400).json({ error: "invalid_filename" });
  }

  const attachment = db
    .prepare(
      `SELECT a.filename, t.reporter_id
       FROM attachments a
       JOIN tickets t ON t.id = a.ticket_id
       WHERE a.filename = ?`
    )
    .get(filename);

  if (!attachment) {
    return res.status(404).json({ error: "file_not_found" });
  }

  if (req.user.role !== "developer" && attachment.reporter_id !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }

  const root = path.resolve(uploadsDir);
  const filePath = path.resolve(path.join(root, filename));
  if (!filePath.startsWith(root)) {
    return res.status(400).json({ error: "invalid_filename" });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "file_not_found" });
  }

  return res.sendFile(path.resolve(filePath));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
