// Runs after core's tables and after every lower layer's, so it is safe to
// reference them with foreign keys. Must be idempotent: core calls it on boot.
function install(db) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS example_layer_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();
}

module.exports = { install };
