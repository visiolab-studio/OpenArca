const rateLimit = require("express-rate-limit");

const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body && req.body.email ? String(req.body.email).toLowerCase() : req.ip),
  message: { error: "too_many_requests" }
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" }
});

module.exports = {
  otpRequestLimiter,
  writeLimiter
};
