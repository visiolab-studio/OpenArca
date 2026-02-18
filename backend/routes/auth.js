const express = require("express");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { validate } = require("../middleware/validate");
const { authRequired } = require("../middleware/auth");
const { otpRequestLimiter } = require("../middleware/rate-limiters");
const { sendEmail } = require("../services/email");
const { jwtSecret, jwtExpiresIn } = require("../config");

const router = express.Router();

const requestOtpSchema = z.object({
  email: z.string().trim().email(),
  lang: z.enum(["pl", "en"]).default("pl")
});

const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().regex(/^\d{8}$/)
});

const patchMeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  language: z.enum(["pl", "en"]).optional()
});

function parseJsonSetting(key, fallback) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch (err) {
    return fallback;
  }
}

function getPublicUser(id) {
  return db
    .prepare("SELECT id, email, name, role, language, created_at, last_login FROM users WHERE id = ?")
    .get(id);
}

function isAllowedDomain(email) {
  const allowedDomains = parseJsonSetting("allowed_domains", []);
  const domain = String(email).split("@")[1]?.toLowerCase();
  return Array.isArray(allowedDomains) && allowedDomains.map((d) => String(d).toLowerCase()).includes(domain);
}

function isDeveloperEmail(email) {
  const developerEmails = parseJsonSetting("developer_emails", []);
  const normalized = String(email).toLowerCase();
  return Array.isArray(developerEmails) && developerEmails.map((d) => String(d).toLowerCase()).includes(normalized);
}

router.post(
  "/request-otp",
  otpRequestLimiter,
  validate({ body: requestOtpSchema }),
  async (req, res, next) => {
    try {
      const email = req.body.email.toLowerCase();
      const lang = req.body.lang;

      if (!isAllowedDomain(email)) {
        return res.status(403).json({ error: "domain_not_allowed" });
      }

      const code = String(Math.floor(10000000 + Math.random() * 90000000));
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

      db.prepare(
        "INSERT INTO otp_codes (id, email, code, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, datetime('now'))"
      ).run(uuidv4(), email, code, expiresAt);

      const subject = lang === "en" ? "Your login code" : "Twój kod logowania";
      const text = lang === "en" ? `Your OTP code is: ${code}` : `Twój kod OTP to: ${code}`;
      await sendEmail({ to: email, subject, text });

      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  }
);

router.post("/verify-otp", validate({ body: verifyOtpSchema }), (req, res) => {
  const email = req.body.email.toLowerCase();
  const code = req.body.code;

  const otp = db
    .prepare(
      "SELECT id, code, expires_at, used FROM otp_codes WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1"
    )
    .get(email);

  if (!otp || otp.code !== code || new Date(otp.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "invalid_or_expired_code" });
  }

  db.prepare("UPDATE otp_codes SET used = 1 WHERE id = ?").run(otp.id);

  const nowIso = new Date().toISOString();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  let userId;

  if (!existing) {
    userId = uuidv4();
    db.prepare(
      "INSERT INTO users (id, email, role, language, created_at, last_login) VALUES (?, ?, ?, 'pl', datetime('now'), ?)"
    ).run(userId, email, isDeveloperEmail(email) ? "developer" : "user", nowIso);
  } else {
    userId = existing.id;
    db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(nowIso, userId);
  }

  const user = getPublicUser(userId);
  const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });

  return res.json({ token, user });
});

router.get("/me", authRequired, (req, res) => {
  return res.json(req.user);
});

router.patch("/me", authRequired, validate({ body: patchMeSchema }), (req, res) => {
  const updates = [];
  const values = [];

  if (typeof req.body.name === "string") {
    updates.push("name = ?");
    values.push(req.body.name);
  }

  if (typeof req.body.language === "string") {
    updates.push("language = ?");
    values.push(req.body.language);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "no_changes" });
  }

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  return res.json(getPublicUser(req.user.id));
});

module.exports = router;
