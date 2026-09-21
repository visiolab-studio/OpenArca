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

// Public intake is the only unauthenticated write path in the product, so it is
// limited on BOTH axes and both are applied. Keying on one alone leaves the
// other open: per-email only lets one host rotate addresses freely, per-IP only
// lets a botnet hammer a single address.
const publicIntakeIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" }
});

const publicIntakeEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.body && req.body.email ? String(req.body.email).trim().toLowerCase() : req.ip,
  message: { error: "too_many_requests" }
});

module.exports = {
  otpRequestLimiter,
  writeLimiter,
  publicIntakeIpLimiter,
  publicIntakeEmailLimiter
};
