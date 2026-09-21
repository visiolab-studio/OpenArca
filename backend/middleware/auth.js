const jwt = require("jsonwebtoken");
const db = require("../db");
const { jwtSecret } = require("../config");
const {
  createServiceAccountsService,
  SERVICE_TOKEN_PREFIX
} = require("../core/service-accounts");

// Built lazily so requiring this module stays cheap and so tests that swap the
// database file behind ../db still get a service bound to the live handle.
let serviceAccounts = null;
function getServiceAccounts() {
  if (!serviceAccounts) {
    serviceAccounts = createServiceAccountsService({ db });
  }
  return serviceAccounts;
}

const USER_COLUMNS = `id, email, name, role, language, avatar_filename, avatar_updated_at, created_at, last_login`;

function loadUser(id) {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id);
}

// A machine token is recognisable on sight by its prefix, so the two identity
// kinds never have to be told apart by trial verification: a value that starts
// with the prefix is only ever checked against service_tokens, and anything
// else is only ever checked as a user JWT.
function isMachineToken(token) {
  return typeof token === "string" && token.startsWith(SERVICE_TOKEN_PREFIX);
}

// Resolves a presented machine token into an identity, or null. Every reason a
// token is not usable — unknown, revoked, expired, account disabled — is
// decided inside verifyToken, and anything unexpected thrown on the way is
// treated as "no identity" rather than surfacing as a 500: a caller must never
// be able to tell those cases apart, and a broken token is a client error.
function resolveMachineIdentity(token) {
  let identity;
  try {
    identity = getServiceAccounts().verifyToken(token);
  } catch {
    return null;
  }
  if (!identity) return null;

  const account = db
    .prepare("SELECT * FROM service_accounts WHERE id = ?")
    .get(identity.accountId);
  if (!account || account.disabled_at) return null;

  // The owner is a real human row; a machine whose owner has been deleted has
  // nobody to act on behalf of, so it has no identity either.
  const owner = loadUser(account.owner_user_id);
  if (!owner) return null;

  return {
    machine: {
      account,
      owner,
      scopes: identity.scopes,
      tokenId: identity.tokenId
    },
    owner
  };
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (isMachineToken(token)) {
    const resolved = resolveMachineIdentity(token);
    if (!resolved) {
      return res.status(401).json({ error: "unauthorized" });
    }

    req.machine = resolved.machine;
    // Shaped from the OWNER so handlers that only ever read req.user.id (the
    // vast majority) keep working unchanged. This is attribution, NOT
    // authority: role is carried for display only, and requireRole refuses a
    // machine outright rather than reading it.
    req.user = { ...resolved.owner, is_machine: true };
    return next();
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = loadUser(payload.sub);

    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "unauthorized" });
  }
}

// Roles belong to people. A service account is its owner's personal tooling and
// reads customer-authored ticket text, so letting it inherit the owner's role
// would turn any sentence a customer writes into a possible instruction to
// delete tickets, change roles or export personal data. A machine therefore
// fails EVERY role gate, whatever its owner is allowed to do; the only way it
// can reach an endpoint is an explicit scope check written for that endpoint.
function requireRole(role) {
  return (req, res, next) => {
    if (req.machine) {
      return res.status(403).json({ error: "forbidden", reason: "machine_identity" });
    }
    if (!req.user) {
      return res.status(401).json({ error: "unauthorized" });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  };
}

// Scope-gated route. A machine identity passes when its token was granted the
// scope; a human identity passes unconditionally — a developer JWT already
// proves the full authority requireRole would otherwise check, so it clears
// any scope gate too, letting one route serve both without a duplicated
// handler. The one thing this must never do is pass when it cannot tell WHO
// is asking: absence of both req.machine and req.user is unauthenticated
// (401), never treated as "no restriction" (which would be a 403-skip bug
// that quietly grants access).
function requireScope(scope) {
  return (req, res, next) => {
    if (!req.machine && !req.user) {
      return res.status(401).json({ error: "unauthorized" });
    }
    if (req.machine) {
      if (!req.machine.scopes || !req.machine.scopes.includes(scope)) {
        return res.status(403).json({ error: "forbidden", reason: "missing_scope", scope });
      }
      return next();
    }
    // A human identity carries no scope list at all; it is authenticated as a
    // person, and requireRole (not requireScope) is what gates person access.
    return next();
  };
}

module.exports = {
  authRequired,
  requireRole,
  requireScope
};
