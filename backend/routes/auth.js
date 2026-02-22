const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { uploadsDir, jwtSecret, jwtExpiresIn } = require("../config");
const { validate } = require("../middleware/validate");
const { authRequired } = require("../middleware/auth");
const { upload } = require("../middleware/uploads");
const { otpRequestLimiter, writeLimiter } = require("../middleware/rate-limiters");
const { sendEmail } = require("../services/email");
const { parseJsonSetting } = require("../services/settings");

const router = express.Router();

const requestOtpSchema = z
  .object({
    email: z.string().trim().email().max(254),
    lang: z.enum(["pl", "en"]).default("pl")
  })
  .strict();

const verifyOtpSchema = z
  .object({
    email: z.string().trim().email().max(254),
    code: z.string().regex(/^\d{8}$/)
  })
  .strict();

const patchMeSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    language: z.enum(["pl", "en"]).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided"
  });

const avatarFilenameSchema = z.object({
  filename: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9]+)?$/i)
});
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function getPublicUser(id) {
  return db
    .prepare(
      `SELECT
        id, email, name, role, language, avatar_filename, avatar_updated_at, created_at, last_login
       FROM users
       WHERE id = ?`
    )
    .get(id);
}

function removeFileIfExists(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_error) {
    // Ignore cleanup failures.
  }
}

function resolveAvatarPath(filename) {
  const root = path.resolve(uploadsDir);
  const filePath = path.resolve(path.join(root, filename));
  if (!filePath.startsWith(root)) {
    return null;
  }
  return filePath;
}

function isAllowedDomain(email) {
  const allowedDomains = parseJsonSetting("allowed_domains", []);
  const domain = String(email).split("@")[1]?.toLowerCase();
  return (
    Array.isArray(allowedDomains) &&
    allowedDomains.map((item) => String(item).toLowerCase()).includes(domain)
  );
}

function isDeveloperEmail(email) {
  const developerEmails = parseJsonSetting("developer_emails", []);
  const normalized = String(email).toLowerCase();
  return (
    Array.isArray(developerEmails) &&
    developerEmails.map((item) => String(item).toLowerCase()).includes(normalized)
  );
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

      const recentCount = db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM otp_codes
           WHERE email = ?
             AND created_at >= datetime('now', '-10 minutes')`
        )
        .get(email).count;

      if (recentCount >= 3) {
        return res.status(429).json({ error: "too_many_requests" });
      }

      const code = String(crypto.randomInt(0, 100000000)).padStart(8, "0");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      db.prepare(
        "INSERT INTO otp_codes (id, email, code, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, datetime('now'))"
      ).run(uuidv4(), email, code, expiresAt);

      const subject = lang === "en" ? "Your login code" : "Twój kod logowania";
      const text =
        lang === "en"
          ? `Your OTP code is: ${code}. It expires in 10 minutes.`
          : `Twój kod OTP to: ${code}. Kod wygasa za 10 minut.`;

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
      `SELECT id, code, expires_at, used
       FROM otp_codes
       WHERE email = ?
         AND code = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(email, code);

  if (!otp || otp.used || new Date(otp.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "invalid_or_expired_code" });
  }

  const nowIso = new Date().toISOString();

  const verifyTx = db.transaction(() => {
    db.prepare("UPDATE otp_codes SET used = 1 WHERE id = ?").run(otp.id);

    let user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (!user) {
      const userId = uuidv4();
      db.prepare(
        "INSERT INTO users (id, email, role, language, created_at, last_login) VALUES (?, ?, ?, 'pl', datetime('now'), ?)"
      ).run(userId, email, isDeveloperEmail(email) ? "developer" : "user", nowIso);
      user = { id: userId };
    } else {
      db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(nowIso, user.id);
    }

    return user.id;
  });

  const userId = verifyTx();
  const user = getPublicUser(userId);
  const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, {
    expiresIn: jwtExpiresIn
  });

  return res.json({ token, user });
});

router.get("/me", authRequired, (req, res) => {
  return res.json(getPublicUser(req.user.id));
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

router.get("/avatar/:filename", validate({ params: avatarFilenameSchema }), (req, res) => {
  const filename = req.params.filename;
  const owner = db
    .prepare("SELECT id FROM users WHERE avatar_filename = ? LIMIT 1")
    .get(filename);

  if (!owner) {
    return res.status(404).json({ error: "file_not_found" });
  }

  const filePath = resolveAvatarPath(filename);
  if (!filePath) {
    return res.status(400).json({ error: "invalid_filename" });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "file_not_found" });
  }

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.sendFile(filePath);
});

router.post("/me/avatar", authRequired, writeLimiter, upload.single("avatar"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "validation_error" });
  }

  if (!ALLOWED_AVATAR_MIME_TYPES.has(req.file.mimetype)) {
    removeFileIfExists(req.file.path);
    return res.status(400).json({ error: "unsupported_file_type" });
  }

  const current = db
    .prepare("SELECT avatar_filename FROM users WHERE id = ?")
    .get(req.user.id);
  const nowIso = new Date().toISOString();

  db.prepare(
    "UPDATE users SET avatar_filename = ?, avatar_updated_at = ? WHERE id = ?"
  ).run(req.file.filename, nowIso, req.user.id);

  if (current?.avatar_filename && current.avatar_filename !== req.file.filename) {
    const oldAvatarPath = resolveAvatarPath(current.avatar_filename);
    removeFileIfExists(oldAvatarPath);
  }

  return res.json(getPublicUser(req.user.id));
});

module.exports = router;
