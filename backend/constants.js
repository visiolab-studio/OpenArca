const ROLES = {
  USER: "user",
  DEVELOPER: "developer"
};

const TICKET_STATUSES = [
  "submitted",
  "verified",
  "in_progress",
  "waiting",
  "blocked",
  "closed"
];

const TICKET_PRIORITIES = ["critical", "high", "normal", "low"];
const TICKET_CATEGORIES = ["bug", "feature", "improvement", "question", "other"];

const DEV_TASK_STATUSES = ["todo", "in_progress", "done"];

const COMMENT_TYPES = ["comment", "question", "answer"];

const STATUS_NOTIFICATION_KEYS = new Set(["verified", "in_progress", "blocked", "closed"]);

const SETTING_KEYS = [
  "allowed_domains",
  "developer_emails",
  "app_name",
  "ticket_counter",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_pass",
  "smtp_from",
  "app_url"
];

module.exports = {
  ROLES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  DEV_TASK_STATUSES,
  COMMENT_TYPES,
  STATUS_NOTIFICATION_KEYS,
  SETTING_KEYS
};
