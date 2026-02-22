const fs = require("fs");
const path = require("path");
const express = require("express");
const { z } = require("zod");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");
const { upload } = require("../middleware/uploads");
const { uploadsDir } = require("../config");
const {
  getSetting,
  getSettingsMap,
  updateSettings
} = require("../services/settings");
const { sendEmail } = require("../services/email");

const router = express.Router();

const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
const logoFilenameRegex = /^[a-z0-9-]+(\.[a-z0-9]+)?$/i;
const LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAIL_PROVIDERS = ["smtp", "ses"];

const patchSettingsSchema = z
  .object({
    allowed_domains: z.array(z.string().trim().toLowerCase().regex(domainRegex)).max(200).optional(),
    developer_emails: z.array(z.string().trim().toLowerCase().email()).max(200).optional(),
    app_name: z.string().trim().min(1).max(120).optional(),
    mail_provider: z.enum(MAIL_PROVIDERS).optional(),
    smtp_host: z.string().trim().max(255).optional(),
    smtp_port: z.coerce.number().int().min(1).max(65535).optional(),
    smtp_user: z.string().trim().max(255).optional(),
    smtp_pass: z.string().max(255).optional(),
    smtp_from: z.string().trim().max(255).optional(),
    ses_region: z.string().trim().max(64).optional(),
    ses_access_key_id: z.string().trim().max(255).optional(),
    ses_secret_access_key: z.string().max(255).optional(),
    ses_session_token: z.string().max(500).optional(),
    ses_from: z.string().trim().max(255).optional(),
    ses_endpoint: z.string().trim().url().max(500).optional(),
    app_url: z.string().trim().url().max(500).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided"
  });
const testSmtpSchema = z.object({
  to: z.string().trim().email()
}).strict();

const privateKeys = new Set([
  "smtp_pass",
  "ses_access_key_id",
  "ses_secret_access_key",
  "ses_session_token"
]);

function parseJsonOrFallback(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function withMaskedPrivateKeys(payload) {
  const next = { ...payload };
  for (const key of privateKeys) {
    if (next[key]) {
      next[key] = "********";
    }
  }
  return next;
}

function buildPublicSettingsPayload(map) {
  const version = String(map.app_logo_updated_at || "").trim();
  const hasLogo = Boolean(String(map.app_logo_filename || "").trim());

  return {
    app_name: map.app_name || "EdudoroIT_SupportCenter",
    app_url: map.app_url || "",
    app_logo_url: hasLogo ? `/api/settings/logo?v=${encodeURIComponent(version || "1")}` : null
  };
}

function buildPrivateSettingsPayload(map) {
  return {
    ...map,
    allowed_domains: parseJsonOrFallback(map.allowed_domains || "[]", []),
    developer_emails: parseJsonOrFallback(map.developer_emails || "[]", []),
    ...buildPublicSettingsPayload(map)
  };
}

function removeFileIfExists(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_error) {
    // Cleanup errors should not block request flow.
  }
}

function getLogoAbsolutePath(filename) {
  if (!logoFilenameRegex.test(filename)) {
    return null;
  }

  const root = path.resolve(uploadsDir);
  const filePath = path.resolve(path.join(root, filename));
  if (!filePath.startsWith(root)) {
    return null;
  }

  return filePath;
}

router.get("/public", (req, res) => {
  const map = getSettingsMap(["app_name", "app_url", "app_logo_filename", "app_logo_updated_at"]);
  return res.json(buildPublicSettingsPayload(map));
});

router.get("/logo", (req, res) => {
  const filename = String(getSetting("app_logo_filename", "") || "").trim();
  if (!filename) {
    return res.status(404).json({ error: "file_not_found" });
  }

  const filePath = getLogoAbsolutePath(filename);
  if (!filePath) {
    return res.status(400).json({ error: "invalid_filename" });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "file_not_found" });
  }

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.sendFile(filePath);
});

router.use(authRequired, requireRole("developer"));

router.get("/", (req, res) => {
  const map = getSettingsMap();
  return res.json(withMaskedPrivateKeys(buildPrivateSettingsPayload(map)));
});

router.patch("/", writeLimiter, validate({ body: patchSettingsSchema }), (req, res) => {
  const changes = {};

  if (req.body.allowed_domains) {
    changes.allowed_domains = JSON.stringify(
      Array.from(new Set(req.body.allowed_domains.map((item) => item.toLowerCase())))
    );
  }

  if (req.body.developer_emails) {
    changes.developer_emails = JSON.stringify(
      Array.from(new Set(req.body.developer_emails.map((item) => item.toLowerCase())))
    );
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "app_name")) {
    changes.app_name = req.body.app_name;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "smtp_host")) {
    changes.smtp_host = req.body.smtp_host;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "mail_provider")) {
    changes.mail_provider = req.body.mail_provider;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "smtp_port")) {
    changes.smtp_port = String(req.body.smtp_port);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "smtp_user")) {
    changes.smtp_user = req.body.smtp_user;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "smtp_pass")) {
    changes.smtp_pass = req.body.smtp_pass;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "smtp_from")) {
    changes.smtp_from = req.body.smtp_from;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "ses_region")) {
    changes.ses_region = req.body.ses_region;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "ses_access_key_id")) {
    changes.ses_access_key_id = req.body.ses_access_key_id;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "ses_secret_access_key")) {
    changes.ses_secret_access_key = req.body.ses_secret_access_key;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "ses_session_token")) {
    changes.ses_session_token = req.body.ses_session_token;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "ses_from")) {
    changes.ses_from = req.body.ses_from;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "ses_endpoint")) {
    changes.ses_endpoint = req.body.ses_endpoint;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "app_url")) {
    changes.app_url = req.body.app_url;
  }

  const changed = updateSettings(changes);
  if (!changed) {
    return res.status(400).json({ error: "no_changes" });
  }

  const map = getSettingsMap();
  return res.json(withMaskedPrivateKeys(buildPrivateSettingsPayload(map)));
});

router.post("/logo", writeLimiter, upload.single("logo"), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "validation_error" });
    }

    if (!LOGO_MIME_TYPES.has(req.file.mimetype)) {
      removeFileIfExists(req.file.path);
      return res.status(400).json({ error: "unsupported_file_type" });
    }

    const currentFilename = String(getSetting("app_logo_filename", "") || "").trim();
    const nowIso = new Date().toISOString();

    updateSettings({
      app_logo_filename: req.file.filename,
      app_logo_updated_at: nowIso
    });

    if (currentFilename && currentFilename !== req.file.filename) {
      const oldLogoPath = getLogoAbsolutePath(currentFilename);
      removeFileIfExists(oldLogoPath);
    }

    const map = getSettingsMap();
    return res.json(withMaskedPrivateKeys(buildPrivateSettingsPayload(map)));
  } catch (error) {
    if (req.file?.path) {
      removeFileIfExists(req.file.path);
    }
    return next(error);
  }
});

async function handleTestEmail(req, res, next) {
  try {
    const subject = "EdudoroIT_SupportCenter email provider test";
    const text = "Email provider test message from EdudoroIT_SupportCenter admin panel.";
    const result = await sendEmail({
      to: req.body.to,
      subject,
      text
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

router.post("/test-smtp", writeLimiter, validate({ body: testSmtpSchema }), handleTestEmail);
router.post("/test-email", writeLimiter, validate({ body: testSmtpSchema }), handleTestEmail);

module.exports = router;
