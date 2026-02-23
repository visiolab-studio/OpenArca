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

const EDITIONS = {
  OPEN_CORE: "open_core",
  ENTERPRISE: "enterprise"
};

const KNOWN_FEATURE_FLAGS = [
  "core_tickets",
  "core_board",
  "core_devtodo",
  "core_admin",
  "enterprise_automation",
  "enterprise_sso_google",
  "enterprise_sso_microsoft",
  "enterprise_sso_saml",
  "enterprise_audit_immutable",
  "enterprise_audit_export",
  "enterprise_data_retention",
  "enterprise_custom_workflows",
  "enterprise_multi_team",
  "enterprise_ai_recall"
];

const SETTING_KEYS = [
  "allowed_domains",
  "developer_emails",
  "app_name",
  "app_logo_filename",
  "app_logo_updated_at",
  "ticket_counter",
  "mail_provider",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_pass",
  "smtp_from",
  "ses_region",
  "ses_access_key_id",
  "ses_secret_access_key",
  "ses_session_token",
  "ses_from",
  "ses_endpoint",
  "app_url",
  "edition",
  "feature_flags"
];

module.exports = {
  ROLES,
  EDITIONS,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  DEV_TASK_STATUSES,
  COMMENT_TYPES,
  STATUS_NOTIFICATION_KEYS,
  KNOWN_FEATURE_FLAGS,
  SETTING_KEYS
};
