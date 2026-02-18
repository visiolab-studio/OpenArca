const express = require("express");
const { z } = require("zod");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");
const { getSettingsMap, updateSettings } = require("../services/settings");
const { sendEmail } = require("../services/email");

const router = express.Router();

const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

const patchSettingsSchema = z
  .object({
    allowed_domains: z.array(z.string().trim().toLowerCase().regex(domainRegex)).max(200).optional(),
    developer_emails: z.array(z.string().trim().toLowerCase().email()).max(200).optional(),
    app_name: z.string().trim().min(1).max(120).optional(),
    smtp_host: z.string().trim().max(255).optional(),
    smtp_port: z.coerce.number().int().min(1).max(65535).optional(),
    smtp_user: z.string().trim().max(255).optional(),
    smtp_pass: z.string().max(255).optional(),
    smtp_from: z.string().trim().max(255).optional(),
    app_url: z.string().trim().url().max(500).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided"
  });
const testSmtpSchema = z.object({
  to: z.string().trim().email()
}).strict();

const privateKeys = new Set(["smtp_pass"]);

function parseJsonOrFallback(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

router.use(authRequired, requireRole("developer"));

router.get("/", (req, res) => {
  const map = getSettingsMap();
  const payload = {
    ...map,
    allowed_domains: parseJsonOrFallback(map.allowed_domains || "[]", []),
    developer_emails: parseJsonOrFallback(map.developer_emails || "[]", [])
  };

  for (const key of privateKeys) {
    if (payload[key]) {
      payload[key] = "********";
    }
  }

  return res.json(payload);
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

  if (Object.prototype.hasOwnProperty.call(req.body, "app_url")) {
    changes.app_url = req.body.app_url;
  }

  const changed = updateSettings(changes);
  if (!changed) {
    return res.status(400).json({ error: "no_changes" });
  }

  const map = getSettingsMap();
  const payload = {
    ...map,
    allowed_domains: parseJsonOrFallback(map.allowed_domains || "[]", []),
    developer_emails: parseJsonOrFallback(map.developer_emails || "[]", [])
  };

  for (const key of privateKeys) {
    if (payload[key]) {
      payload[key] = "********";
    }
  }

  return res.json(payload);
});

router.post("/test-smtp", writeLimiter, validate({ body: testSmtpSchema }), async (req, res, next) => {
  try {
    const subject = "EdudoroIT_SupportCenter SMTP test";
    const text = "SMTP test message from EdudoroIT_SupportCenter admin panel.";
    const result = await sendEmail({
      to: req.body.to,
      subject,
      text
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
