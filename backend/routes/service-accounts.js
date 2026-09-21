const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rate-limiters");
const {
  createServiceAccountsService,
  SERVICE_TOKEN_SCOPES,
  ServiceAccountError
} = require("../core/service-accounts");

// Self-service surface for MACHINE identities.
//
// A service account is personal tooling: it is bound to the developer who
// created it, runs on that developer's own hardware, and is theirs alone to
// see, mint, disable or revoke. It is never a shared administrative resource,
// so every lookup below is scoped to req.user.id and nothing wider. Acting on
// another developer's account must look exactly like the account not
// existing — a 404, never a 403 — so a developer can never learn from the
// response shape whether a given id belongs to someone else.
const router = express.Router();

const accounts = createServiceAccountsService({ db });

const idParamsSchema = z.object({ id: z.string().uuid() });

const createAccountSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
    scopes: z.array(z.enum(SERVICE_TOKEN_SCOPES)).min(1).max(SERVICE_TOKEN_SCOPES.length)
  })
  .strict();

function getOwnedAccount(id, ownerUserId) {
  const account = db.prepare("SELECT * FROM service_accounts WHERE id = ?").get(id);
  // A row that exists but belongs to someone else is treated identically to
  // no row at all: existence itself is not something this endpoint discloses.
  if (!account || account.owner_user_id !== ownerUserId) return null;
  return account;
}

// The token shown to the developer is always the most recently minted one for
// that account — today, an account has exactly one at a time (revoke replaces
// rather than accumulating), but this stays correct if that ever changes.
function getLatestToken(accountId) {
  return db
    .prepare("SELECT * FROM service_tokens WHERE account_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(accountId);
}

function buildAccountPayload(account, token) {
  return {
    id: account.id,
    name: account.name,
    description: account.description || null,
    created_at: account.created_at,
    disabled_at: account.disabled_at || null,
    scopes: token ? JSON.parse(token.scopes_json || "[]") : [],
    last_used_at: token ? token.last_used_at || null : null,
    revoked_at: token ? token.revoked_at || null : null,
    expires_at: token ? token.expires_at || null : null
  };
}

router.get("/", authRequired, requireRole("developer"), (req, res) => {
  const rows = accounts.listByOwner(req.user.id);
  const payload = rows.map((account) => buildAccountPayload(account, getLatestToken(account.id)));
  return res.json(payload);
});

router.post(
  "/",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ body: createAccountSchema }),
  (req, res, next) => {
    try {
      const account = accounts.create({
        name: req.body.name,
        ownerUserId: req.user.id,
        description: req.body.description || null
      });

      const minted = accounts.mintToken({
        accountId: account.id,
        scopes: req.body.scopes
      });

      const payload = buildAccountPayload(account, {
        scopes_json: JSON.stringify(minted.scopes),
        last_used_at: null,
        revoked_at: null,
        expires_at: minted.expiresAt
      });
      // The clear token is handed back EXACTLY ONCE, on this response only.
      // Nothing server-side stores it, so nothing can hand it back later.
      payload.token = minted.clearToken;

      return res.status(201).json(payload);
    } catch (error) {
      if (error instanceof ServiceAccountError) {
        error.status = 400;
      }
      return next(error);
    }
  }
);

router.post(
  "/:id/disable",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema }),
  (req, res) => {
    const account = getOwnedAccount(req.params.id, req.user.id);
    if (!account) {
      return res.status(404).json({ error: "service_account_not_found" });
    }

    if (!account.disabled_at) {
      db.prepare("UPDATE service_accounts SET disabled_at = datetime('now') WHERE id = ?").run(account.id);
    }

    const updated = db.prepare("SELECT * FROM service_accounts WHERE id = ?").get(account.id);
    return res.json(buildAccountPayload(updated, getLatestToken(updated.id)));
  }
);

router.post(
  "/:id/revoke",
  authRequired,
  requireRole("developer"),
  writeLimiter,
  validate({ params: idParamsSchema }),
  (req, res) => {
    const account = getOwnedAccount(req.params.id, req.user.id);
    if (!account) {
      return res.status(404).json({ error: "service_account_not_found" });
    }

    const token = getLatestToken(account.id);
    if (token && !token.revoked_at) {
      accounts.revokeToken(token.id);
    }

    const refreshedToken = getLatestToken(account.id);
    return res.json(buildAccountPayload(account, refreshedToken));
  }
);

module.exports = router;
