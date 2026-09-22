const { randomUUID, createHash, randomBytes, timingSafeEqual } = require("node:crypto");

// Machine identity for local coding agents (Claude Code, Codex, ...).
//
// A service account is bound to a human owner. The agent runs on that
// developer's own hardware, under their supervision — it is personal
// tooling, never a shared administrative identity. The schema encodes this:
// owner_user_id is required, and nothing here grants a service account the
// owner's role. Ticket text is customer-authored, so an agent reading tickets
// must never be able to escalate into whatever the owner is allowed to do —
// that is decided later by whatever checks scopes_json, not by this table.
//
// Tokens are stored hashed only. No column ever holds the clear token; the
// caller hashes it (see hashToken) before it reaches the database, and the
// clear value is returned to the caller exactly once, at creation time.

function installServiceAccountSchema(db) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS service_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL REFERENCES users(id),
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      disabled_at TEXT
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS service_tokens (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES service_accounts(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      scopes_json TEXT NOT NULL DEFAULT '[]',
      expires_at TEXT,
      last_used_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();

  db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_service_accounts_owner ON service_accounts(owner_user_id)"
  ).run();
  db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_service_tokens_account ON service_tokens(account_id)"
  ).run();
  // Verification looks a token up by its hash and nothing else.
  db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_service_tokens_hash ON service_tokens(token_hash)"
  ).run();
}

// The scope vocabulary is a CLOSED set, defined here and nowhere else.
//
// Every scope listed is read-or-propose. None of them let an agent act as its
// owner: it can read tickets and projects, comment, and PROPOSE a reply — a
// human still sends it. Ticket text is customer-authored, so anything an agent
// reads is untrusted input; keeping the vocabulary closed means a typo at mint
// time ("tickets:reply") cannot quietly create a scope no enforcement point
// knows how to check, which would read as "allowed" to a naive caller.
const SERVICE_TOKEN_SCOPES = Object.freeze([
  "tickets:read",
  "tickets:comment",
  "tickets:propose_reply",
  "projects:read"
]);

// Prefix so an OpenArca machine token is recognisable on sight in a log, a
// paste, or a secret scanner, and distinguishable from a user JWT.
const SERVICE_TOKEN_PREFIX = "oa_";

class ServiceAccountError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ServiceAccountError";
    this.code = code;
  }
}

// SQLite's datetime('now') format, in UTC — the same shape the column defaults
// to, so stored values compare and read consistently however they were written.
function toSqliteUtc(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ServiceAccountError("INVALID_TIMESTAMP", `not a usable timestamp: ${value}`);
  }
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseSqliteUtc(value) {
  if (!value) return null;
  const normalised = /[TZ]/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalised);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normaliseScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new ServiceAccountError("EMPTY_SCOPES", "at least one scope is required");
  }
  const seen = [];
  for (const scope of scopes) {
    if (!SERVICE_TOKEN_SCOPES.includes(scope)) {
      throw new ServiceAccountError(
        "UNKNOWN_SCOPE",
        `unknown scope: ${String(scope)} (allowed: ${SERVICE_TOKEN_SCOPES.join(", ")})`
      );
    }
    if (!seen.includes(scope)) seen.push(scope);
  }
  return seen;
}

// 32 bytes from the CSPRNG — 256 bits, far beyond guessing — rendered base64url
// so the token stays copy-pasteable and URL-safe.
function generateClearToken() {
  return SERVICE_TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

// A hash that exists only so the not-found case costs the same as the found
// case; it can never equal a real SHA-256 hex digest of anything.
const ABSENT_TOKEN_HASH = "0".repeat(64);

function hashesMatch(a, b) {
  const left = Buffer.from(String(a), "utf8");
  const right = Buffer.from(String(b), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

// SHA-256 of the clear token. Deterministic and unsalted on purpose: lookup at
// auth time has to find the row by hash alone (no per-row salt to try), and
// the tokens themselves are long, random, high-entropy secrets generated by
// us — not user-chosen passwords — so this is not the weak case a salted,
// slow KDF exists to defend against.
function hashToken(clearToken) {
  if (typeof clearToken !== "string" || clearToken.length === 0) {
    throw new Error("hashToken requires a non-empty string");
  }
  return createHash("sha256").update(clearToken, "utf8").digest("hex");
}

function createServiceAccountsService({ db, now = () => new Date() }) {
  function create({ name, ownerUserId, description }) {
    if (!name || !String(name).trim()) {
      throw new Error("name is required");
    }
    if (!ownerUserId) {
      throw new Error("ownerUserId is required");
    }

    const id = randomUUID();
    db.prepare(
      "INSERT INTO service_accounts (id, name, owner_user_id, description) VALUES (?, ?, ?, ?)"
    ).run(id, String(name).trim(), ownerUserId, description || null);

    return db.prepare("SELECT * FROM service_accounts WHERE id = ?").get(id);
  }

  function listByOwner(ownerUserId) {
    return db
      .prepare("SELECT * FROM service_accounts WHERE owner_user_id = ? ORDER BY created_at")
      .all(ownerUserId);
  }

  // Returns the clear token EXACTLY ONCE. Nothing stores it, so nothing can
  // hand it back later — a lost token is reminted, never recovered.
  function mintToken({ accountId, scopes, expiresAt = null }) {
    if (!accountId) {
      throw new ServiceAccountError("ACCOUNT_REQUIRED", "accountId is required");
    }
    const account = db
      .prepare("SELECT * FROM service_accounts WHERE id = ?")
      .get(accountId);
    if (!account) {
      throw new ServiceAccountError("UNKNOWN_ACCOUNT", `no such service account: ${accountId}`);
    }

    // Validated BEFORE anything is written, so a rejected scope leaves no row.
    const validScopes = normaliseScopes(scopes);
    const expiresAtValue = expiresAt === null || expiresAt === undefined
      ? null
      : toSqliteUtc(expiresAt);

    const clearToken = generateClearToken();
    const id = randomUUID();
    db.prepare(
      `INSERT INTO service_tokens (id, account_id, token_hash, scopes_json, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      accountId,
      hashToken(clearToken),
      JSON.stringify(validScopes),
      expiresAtValue,
      toSqliteUtc(now())
    );

    return { id, accountId, clearToken, scopes: validScopes, expiresAt: expiresAtValue };
  }

  // The ONE path a caller uses to turn a presented token into an identity.
  // Revocation and expiry are decided here, not by a separate check a caller
  // could forget: an invalid token for any reason returns null, and the
  // caller has no way to obtain a row that skipped these tests.
  function verifyToken(presentedToken) {
    if (typeof presentedToken !== "string" || presentedToken.length === 0) {
      return null;
    }

    let presentedHash;
    try {
      presentedHash = hashToken(presentedToken);
    } catch {
      return null;
    }

    const row = db
      .prepare("SELECT * FROM service_tokens WHERE token_hash = ?")
      .get(presentedHash);

    // Compared in constant time whether or not a row was found, so a caller
    // watching the clock learns nothing about which hashes exist.
    const matches = hashesMatch(row ? row.token_hash : ABSENT_TOKEN_HASH, presentedHash);
    if (!row || !matches) return null;

    if (row.revoked_at) return null;

    const at = now();
    const expiresAt = parseSqliteUtc(row.expires_at);
    if (expiresAt && expiresAt.getTime() <= at.getTime()) return null;

    const account = db
      .prepare("SELECT * FROM service_accounts WHERE id = ?")
      .get(row.account_id);
    // A disabled account's tokens die with it, through this same path.
    if (!account || account.disabled_at) return null;

    const usedAt = toSqliteUtc(at);
    db.prepare("UPDATE service_tokens SET last_used_at = ? WHERE id = ?").run(usedAt, row.id);

    let scopes = [];
    try {
      const parsed = JSON.parse(row.scopes_json);
      if (Array.isArray(parsed)) scopes = parsed;
    } catch {
      scopes = [];
    }

    return {
      tokenId: row.id,
      accountId: account.id,
      ownerUserId: account.owner_user_id,
      // Only scopes still in the vocabulary survive; one dropped from the set
      // in a later version stops being honoured without a data migration.
      scopes: scopes.filter((scope) => SERVICE_TOKEN_SCOPES.includes(scope)),
      lastUsedAt: usedAt
    };
  }

  function revokeToken(tokenId) {
    const result = db
      .prepare("UPDATE service_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
      .run(toSqliteUtc(now()), tokenId);
    return result.changes > 0;
  }

  function listTokens(accountId) {
    return db
      .prepare("SELECT * FROM service_tokens WHERE account_id = ? ORDER BY created_at")
      .all(accountId);
  }

  return { create, listByOwner, mintToken, verifyToken, revokeToken, listTokens };
}

module.exports = {
  installServiceAccountSchema,
  hashToken,
  createServiceAccountsService,
  SERVICE_TOKEN_SCOPES,
  SERVICE_TOKEN_PREFIX,
  ServiceAccountError
};
