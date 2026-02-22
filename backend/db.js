const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { sqlitePath } = require("./config");

function ensureParentDir(filePath) {
  const parent = path.dirname(filePath);
  fs.mkdirSync(parent, { recursive: true });
}

ensureParentDir(sqlitePath);

const db = new Database(sqlitePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    language TEXT NOT NULL DEFAULT 'pl',
    avatar_filename TEXT,
    avatar_updated_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS otp_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6B7280',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    steps_to_reproduce TEXT,
    expected_result TEXT,
    actual_result TEXT,
    environment TEXT,
    urgency_reporter TEXT NOT NULL DEFAULT 'normal',
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'submitted',
    category TEXT NOT NULL DEFAULT 'other',
    project_id TEXT REFERENCES projects(id),
    reporter_id TEXT NOT NULL REFERENCES users(id),
    assignee_id TEXT REFERENCES users(id),
    estimated_hours REAL,
    planned_date TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    internal_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS ticket_history (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id),
    user_id TEXT REFERENCES users(id),
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id),
    user_id TEXT REFERENCES users(id),
    content TEXT NOT NULL,
    is_developer INTEGER NOT NULL DEFAULT 0,
    is_internal INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'comment',
    parent_id TEXT REFERENCES comments(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id),
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS dev_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    estimated_hours REAL,
    planned_date TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    order_index INTEGER NOT NULL DEFAULT 0,
    ticket_id TEXT REFERENCES tickets(id),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_otp_codes_email_created ON otp_codes(email, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_otp_codes_email_used ON otp_codes(email, used)`,
  `CREATE INDEX IF NOT EXISTS idx_tickets_reporter_status ON tickets(reporter_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id, created_at)`
];

const defaultSettings = [
  ["allowed_domains", '["example.com"]'],
  ["developer_emails", "[]"],
  ["app_name", "EdudoroIT_SupportCenter"],
  ["app_logo_filename", ""],
  ["app_logo_updated_at", ""],
  ["ticket_counter", "0"],
  ["mail_provider", "smtp"],
  ["smtp_host", ""],
  ["smtp_port", "587"],
  ["smtp_user", ""],
  ["smtp_pass", ""],
  ["smtp_from", ""],
  ["ses_region", ""],
  ["ses_access_key_id", ""],
  ["ses_secret_access_key", ""],
  ["ses_session_token", ""],
  ["ses_from", ""],
  ["ses_endpoint", ""],
  ["app_url", "http://localhost:3000"]
];

function initDb() {
  const migrate = db.transaction(() => {
    for (const statement of schemaStatements) {
      db.prepare(statement).run();
    }

    const userColumns = db.prepare("PRAGMA table_info(users)").all();
    const userColumnNames = new Set(userColumns.map((column) => String(column.name)));

    if (!userColumnNames.has("avatar_filename")) {
      db.prepare("ALTER TABLE users ADD COLUMN avatar_filename TEXT").run();
    }

    if (!userColumnNames.has("avatar_updated_at")) {
      db.prepare("ALTER TABLE users ADD COLUMN avatar_updated_at TEXT").run();
    }

    const insertSetting = db.prepare(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
    );

    for (const [key, value] of defaultSettings) {
      insertSetting.run(key, value);
    }
  });

  migrate();
}

initDb();

module.exports = db;
