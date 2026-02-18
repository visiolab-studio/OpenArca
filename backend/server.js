require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { port, frontendOrigin, uploadsDir, dataDir, sqlitePath } = require("./config");
const db = require("./db");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const devTaskRoutes = require("./routes/devTasks");
const projectRoutes = require("./routes/projects");
const userRoutes = require("./routes/users");
const settingsRoutes = require("./routes/settings");
const { authRequired } = require("./middleware/auth");
const { notFound, errorHandler } = require("./middleware/error-handler");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

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
    origin: frontendOrigin,
    credentials: false,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

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

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/dev-tasks", devTaskRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);

app.get("/api/uploads/:filename", authRequired, (req, res) => {
  const filename = String(req.params.filename || "");
  if (!/^[a-z0-9-]+(\.[a-z0-9]+)?$/i.test(filename)) {
    return res.status(400).json({ error: "invalid_filename" });
  }

  const filePath = path.join(uploadsDir, filename);
  if (!filePath.startsWith(path.resolve(uploadsDir))) {
    return res.status(400).json({ error: "invalid_filename" });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "file_not_found" });
  }

  return res.sendFile(path.resolve(filePath));
});

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  db.prepare("SELECT 1").get();
  console.log(`Backend listening on port ${port}`);
});
