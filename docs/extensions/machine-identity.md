# Machine identity

Status: **accepted** — 2026-09-21
Implements: plan task `P1-T03`, `P1-T06`. Used by integration with local coding agents (Claude Code, Codex, …).

OpenArca supports integration with local coding agents — tools that run on a developer's own hardware, under their supervision, and can read tickets and comment on them. This document defines how a machine identity is represented, what scopes it carries, and why it is never a role.

## Why this exists

Before machine identity, there was no way to represent an agent. The auth layer knew only `authRequired` (resolve a JWT to a user) and `requireRole` (check the user's role). An agent reading customer-authored ticket text would have to either not be authenticated (and hit role gates as a public user) or reuse the owner's credentials and therefore inherit the owner's role — making any phrase a customer writes a possible instruction to delete tickets, change roles, or export personal data.

This is unacceptable. A machine therefore does not have a role. It has a **scope set**, which is entirely separate from roles and cannot grant one.

## Terminology

A **service account** is a row in the `service_accounts` table with a name, description, and — crucially — an `owner_user_id` pointing to a real human. An agent is never a shared administrative identity; it belongs to one person, runs on that person's hardware, and acts under their supervision.

A **service token** is a row in `service_tokens`, carrying a hashed token, a scope set, and optional expiry. The token itself is a 32-byte random value, prefixed `oa_` so it is recognisable in logs and secret scanners and distinguishable from a user JWT.

A **scope** is one item from the closed vocabulary defined below. A token carries an array of scopes; an endpoint checks whether a scope is present, not whether a user role is.

A machine identity is present on a request as `req.machine` — a structure with `account`, `owner`, `scopes`, and `tokenId`. It is **never** present alongside a human JWT; a Bearer token is either a machine token (prefix `oa_`) or a user JWT, never both.

## The rule: scope, never role

A machine account's `owner_user_id` is set once at creation and never changes. An endpoint that receives a machine identity can therefore call code like this:

```js
function attribution(req) {
  if (req.machine) {
    return `${req.machine.account.name} (agent of ${req.machine.owner.name})`;
  }
  return `${req.user.name}`;
}
```

What it must **never** do is this:

```js
// WRONG — will NOT pass code review
if (req.user.role === "developer") {
  // … dangerous operation …
}
```

The middleware `authRequired` shapes `req.user` from the machine's owner so that handlers reading `req.user.id` (the vast majority) continue to work without change. **This is attribution, not authority.** The role field is present for display only. The middleware `requireRole` rejects any request carrying a machine identity **before** it reads the role, returning 403 with `reason: "machine_identity"`:

```js
function requireRole(role) {
  return (req, res, next) => {
    if (req.machine) {
      // A machine reads ticket text, which is customer-authored. Refusing the
      // role gate entirely — before checking the role — ensures that ticket
      // text cannot escalate into whatever the owner is allowed to do.
      return res.status(403).json({ error: "forbidden", reason: "machine_identity" });
    }
    // … the ordinary role check …
  };
}
```

A machine can therefore reach an endpoint **only in two ways**:

1. The endpoint does not use `requireRole` (it is either unauthenticated or checks only `req.user.id` for attribution).
2. The endpoint explicitly checks a scope: `if (!req.machine?.scopes.includes("tickets:read")) { return res.status(403)…; }`.

Allowing a machine through a role gate is not possible. Typos and oversights therefore fail safe.

## Scope vocabulary

The vocabulary is closed. Only these scopes exist; new scopes are added by a code change to `backend/core/service-accounts.js`, not minted at token creation time. This ensures that an enforcement point cannot unknowingly enforce a scope a future code change makes unsupported.

| Scope | What it permits |
|---|---|
| `tickets:read` | Read ticket bodies, metadata, and replies. |
| `tickets:comment` | Post a new comment on a ticket. The comment is user-authored; a machine cannot send it directly — only propose it, for the owner to review and send. |
| `tickets:propose_reply` | Propose a reply to a ticket. Again, the owner sends it. |
| `projects:read` | Read project names, descriptions, and metadata. Does not read the team's private notes or settings. |

Every scope is read-or-propose. None of them let an agent send a message or change a setting as if it were the owner. A machine is a tool for the owner to use, not a stand-in for them.

## Storage: why only hashes

The `service_tokens` table stores `token_hash`, never the clear token. The clear token is returned to the caller exactly once, at creation time, and is never recoverable.

The hash is SHA-256, unsalted, of the clear token. This is safe because:

- Tokens are 32 bytes of CSPRNG output — high-entropy secrets generated by the system, not user-chosen passwords.
- Lookup at auth time has to find the row by hash alone, with no per-row salt to try — the lookup uses an index on `token_hash`.
- A bearer token is a temporary credential in transit; if it is exposed in a log or pasted somewhere, the next step is immediate revocation, not a password reset.

A missing token cannot be recovered. A developer who loses a token remints one; the lost one is unrecoverable and can only be revoked.

## Ownership

A service account is a row in the database, and its `owner_user_id` field is not nullable. The account belongs to one person. The machinery is:

- The `authRequired` middleware verifies the token and loads the account row.
- It checks that the account is not disabled (`disabled_at IS NULL`).
- It checks that the owner still exists and has not been deleted.
- It sets `req.machine` and shapes `req.user` from the owner.

When the owner is deleted, the account has no identity — the agent has nobody to act on behalf of. Later verification attempts fail at the "check the owner exists" step and return 401, the same as an unknown token or a revoked one. A developer therefore cannot see another developer's service accounts; each developer manages only their own.

The account may be disabled independently (setting `disabled_at` to a non-null value) without deleting the owner, in case an agent needs to be quickly shut off without altering the owner's own account.

## Token lifecycle

1. **Creation.** `mintToken({ accountId, scopes, expiresAt })` generates a 32-byte token, hashes it, stores the hash with the scope set, and returns the clear token to the caller. Clear tokens are never stored after this point.

2. **Verification.** On an auth attempt, `verifyToken(presentedToken)` hashes the presented token, looks it up by hash, checks that it has not been revoked and has not expired, and returns the identity (account, owner, scopes) or null.

3. **Revocation.** `revokeToken(tokenId)` sets `revoked_at` to the current time. Revoked tokens fail verification and can never be un-revoked. This is the only permanent state change to a token; even expiry can be checked at verification time without writing anything.

4. **Expiry.** If a token is minted with `expiresAt`, verification checks that the current time is strictly before the expiry time. Expired tokens fail verification but can be reminted with a later expiry. A token with no `expiresAt` does not expire.

## Personal data

A service account is personal to its owner. When a user is deleted, their service accounts must be deleted or have their `owner_user_id` cleared — otherwise the account becomes an orphan with nobody to attribute it to. Core's user erasure runs the layer's personal-data handlers before deleting the user, so a layer can clean up any records that reference a user.

A layer that uses service accounts would add an `erase` handler to clear its references:

```js
module.exports = {
  erase({ db, subject }) {
    db.prepare("DELETE FROM my_table WHERE agent_account_id IN (SELECT id FROM service_accounts WHERE owner_user_id = ?)").run(subject.id);
    return { deleted: true };
  }
};
```

---

## Adoption checklist for new endpoints

Before an endpoint decides whether to let a machine reach it, the author should ask:

- Does this endpoint read customer-authored data (ticket text, attachments, etc.)? **Yes** → require explicit scope checks; do not use `requireRole`.
- Does this endpoint modify state (create, update, delete)? **Yes** → machine identity should probably not be allowed; if it must be, define new scopes explicitly rather than reusing human-facing ones.
- Does this endpoint call through to `requireRole`? **Yes** → it automatically refuses machines; no explicit check needed.
- Is the endpoint primarily for display and attribution (e.g. "who created this")? **Yes** → machine tokens are fine; `req.user.id` works as-is.
