// Resolves which host an instance is being addressed as, from a configured
// allowlist.
//
// The security rule this exists to enforce: an inbound Host or X-Forwarded-Host
// header may only SELECT an entry from the allowlist — it may never define one.
// Absolute links in email are built from the result, so a reflected host would
// turn an OTP mail into an attacker-controlled redirect, and OTP is the only way
// into the product.
//
// See docs/multi-host.md.

function normalizeOrigin(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return null;

  let parsed;
  try {
    parsed = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  return parsed.origin;
}

function parseOriginList(rawValue) {
  if (typeof rawValue !== "string") return [];

  const seen = new Set();
  const origins = [];

  for (const entry of rawValue.split(",")) {
    const origin = normalizeOrigin(entry);
    if (origin && !seen.has(origin)) {
      seen.add(origin);
      origins.push(origin);
    }
  }

  return origins;
}

// The first entry is canonical: it is what links fall back to when a request
// cannot be attributed to an allowed host.
function resolveAllowedOrigins({ env = process.env, fallback } = {}) {
  const configured = parseOriginList(env.ALLOWED_HOSTS);
  if (configured.length > 0) {
    return configured;
  }

  // Single-host installs keep working untouched.
  const single =
    normalizeOrigin(env.FRONTEND_ORIGIN) ||
    normalizeOrigin(env.APP_URL) ||
    normalizeOrigin(fallback);

  return single ? [single] : [];
}

function isAllowedOrigin(origin, allowedOrigins) {
  const normalized = normalizeOrigin(origin);
  return Boolean(normalized) && allowedOrigins.includes(normalized);
}

// Derives the origin a request was addressed to, but ONLY by matching the
// allowlist. An unrecognised host falls back to the canonical origin; it is
// never echoed back, and never used to build a link.
function resolveRequestOrigin(req, allowedOrigins, { canonical } = {}) {
  const fallbackOrigin = canonical || allowedOrigins[0] || null;

  if (!req || allowedOrigins.length === 0) {
    return fallbackOrigin;
  }

  const forwardedHost = req.headers?.["x-forwarded-host"];
  const forwardedProto = req.headers?.["x-forwarded-proto"];
  const host = req.headers?.host;

  const candidates = [];

  // A proxy may send a comma-separated chain; only the first hop is meaningful
  // and the rest are attacker-appendable.
  if (typeof forwardedHost === "string" && forwardedHost.trim()) {
    const firstHop = forwardedHost.split(",")[0].trim();
    const proto =
      typeof forwardedProto === "string" && forwardedProto.trim()
        ? forwardedProto.split(",")[0].trim()
        : null;
    candidates.push(proto ? `${proto}://${firstHop}` : firstHop);
  }

  if (typeof host === "string" && host.trim()) {
    candidates.push(host.trim());
  }

  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate);
    if (normalized && allowedOrigins.includes(normalized)) {
      return normalized;
    }

    // A bare host matches regardless of scheme, so an http request to an
    // https-configured host still resolves rather than silently falling back.
    if (!candidate.includes("://")) {
      const asHttps = normalizeOrigin(`https://${candidate}`);
      const asHttp = normalizeOrigin(`http://${candidate}`);
      if (asHttps && allowedOrigins.includes(asHttps)) return asHttps;
      if (asHttp && allowedOrigins.includes(asHttp)) return asHttp;
    }
  }

  return fallbackOrigin;
}

module.exports = {
  normalizeOrigin,
  parseOriginList,
  resolveAllowedOrigins,
  isAllowedOrigin,
  resolveRequestOrigin
};
