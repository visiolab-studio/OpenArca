const { outboxWorkerEnabled, port } = require("./config");
const db = require("./db");
const app = require("./app");
const { outboxWorkerService } = require("./services/outbox-worker");

const server = app.listen(port, () => {
  db.prepare("SELECT 1").get();
  console.log(`Backend listening on port ${port}`);

  if (outboxWorkerEnabled) {
    outboxWorkerService.start();
    console.log("[outbox-worker] started");
  }
});

function gracefulShutdown(signal) {
  if (outboxWorkerEnabled) {
    outboxWorkerService.stop();
    console.log("[outbox-worker] stopped");
  }

  server.close(() => {
    console.log(`Backend stopped after ${signal}`);
    process.exit(0);
  });
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
