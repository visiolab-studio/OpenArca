const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const {
  installServiceAccountSchema,
  hashToken,
  createServiceAccountsService,
  SERVICE_TOKEN_SCOPES,
  SERVICE_TOKEN_PREFIX
} = require("../core/service-accounts");

function createDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openarca-service-accounts-"));
  const db = new Database(path.join(dir, "test.sqlite"));
  db.pragma("foreign_keys = ON");
  db.prepare("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT)").run();
  installServiceAccountSchema(db);
  db.prepare("INSERT INTO users (id, email) VALUES ('u1', 'dev@example.com')").run();
  return { db, dir };
}

test("both tables exist after installing the schema on a fresh database", () => {
  const { db, dir } = createDb();

  const tableNames = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);

  assert.ok(tableNames.includes("service_accounts"));
  assert.ok(tableNames.includes("service_tokens"));

  fs.rmSync(dir, { recursive: true, force: true });
});

test("installing the schema again on an already-migrated database is a no-op", () => {
  const { db, dir } = createDb();

  // Simulates boot of an EXISTING install: the guard (CREATE TABLE IF NOT
  // EXISTS) must not touch data already there.
  const service = createServiceAccountsService({ db });
  service.create({ name: "claude-code", ownerUserId: "u1" });

  assert.doesNotThrow(() => installServiceAccountSchema(db));
  assert.equal(service.listByOwner("u1").length, 1);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("an install with no service accounts behaves exactly as before", () => {
  const { db, dir } = createDb();

  // The defining acceptance criterion of this phase: adding the capability
  // must not change behavior for a deployment that never uses it.
  const accounts = db.prepare("SELECT * FROM service_accounts").all();
  const tokens = db.prepare("SELECT * FROM service_tokens").all();

  assert.deepEqual(accounts, []);
  assert.deepEqual(tokens, []);

  const service = createServiceAccountsService({ db });
  assert.deepEqual(service.listByOwner("u1"), []);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("token_hash cannot be null and no column holds the clear token", () => {
  const { db, dir } = createDb();

  const service = createServiceAccountsService({ db });
  const account = service.create({ name: "claude-code", ownerUserId: "u1" });

  assert.throws(() => {
    db.prepare(
      "INSERT INTO service_tokens (id, account_id, token_hash, scopes_json) VALUES ('t1', ?, NULL, '[]')"
    ).run(account.id);
  });

  const columns = db.prepare("PRAGMA table_info(service_tokens)").all();
  const columnNames = columns.map((c) => c.name);
  assert.ok(!columnNames.includes("token"));
  assert.ok(!columnNames.includes("clear_token"));

  const clearToken = "sk_test_abcdef1234567890";
  const hashed = hashToken(clearToken);
  db.prepare(
    "INSERT INTO service_tokens (id, account_id, token_hash, scopes_json) VALUES ('t2', ?, ?, '[]')"
  ).run(account.id, hashed);

  const stored = db.prepare("SELECT * FROM service_tokens WHERE id = 't2'").get();
  assert.equal(stored.token_hash, hashed);
  assert.notEqual(stored.token_hash, clearToken);
  assert.ok(!Object.values(stored).includes(clearToken));

  fs.rmSync(dir, { recursive: true, force: true });
});

test("a service account requires a human owner", () => {
  const { db, dir } = createDb();
  const service = createServiceAccountsService({ db });

  assert.throws(() => service.create({ name: "no-owner" }));

  assert.throws(() => {
    db.prepare(
      "INSERT INTO service_accounts (id, name, owner_user_id) VALUES ('a1', 'x', 'does-not-exist')"
    ).run();
  });

  fs.rmSync(dir, { recursive: true, force: true });
});

// A movable clock. Token lifetimes are the whole point of this module, and
// real wall-clock waits would make the expiry tests slow and flaky.
function createClock(startIso) {
  let current = new Date(startIso);
  return {
    now: () => new Date(current.getTime()),
    advanceSeconds(seconds) {
      current = new Date(current.getTime() + seconds * 1000);
    }
  };
}

function withAccount(clock) {
  const { db, dir } = createDb();
  const service = createServiceAccountsService(
    clock ? { db, now: clock.now } : { db }
  );
  const account = service.create({ name: "claude-code", ownerUserId: "u1" });
  return { db, dir, service, account };
}

test("a minted token verifies, and carries its owner and scopes", () => {
  const { db, dir, service, account } = withAccount();

  const minted = service.mintToken({
    accountId: account.id,
    scopes: ["tickets:read", "projects:read"]
  });

  assert.ok(minted.clearToken.startsWith(SERVICE_TOKEN_PREFIX));
  // Recognisable in a log AND long enough that guessing is hopeless.
  assert.ok(minted.clearToken.length > 40);

  const verified = service.verifyToken(minted.clearToken);
  assert.ok(verified, "a freshly minted token must verify");
  assert.equal(verified.tokenId, minted.id);
  assert.equal(verified.accountId, account.id);
  // The agent is its owner's property, not a role of its own.
  assert.equal(verified.ownerUserId, "u1");
  assert.deepEqual(verified.scopes, ["tickets:read", "projects:read"]);

  assert.equal(service.verifyToken("oa_not-a-real-token"), null);
  assert.equal(service.verifyToken(""), null);
  assert.equal(service.verifyToken(undefined), null);

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the same token stops verifying once it is revoked", () => {
  const { db, dir, service, account } = withAccount();

  const minted = service.mintToken({ accountId: account.id, scopes: ["tickets:read"] });
  assert.ok(service.verifyToken(minted.clearToken));

  assert.equal(service.revokeToken(minted.id), true);

  // Same token, same call, now refused — the revocation check lives inside
  // verifyToken, so no caller can reach the identity by skipping it.
  assert.equal(service.verifyToken(minted.clearToken), null);

  // Revoking twice is not a second revocation.
  assert.equal(service.revokeToken(minted.id), false);

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("an expired token does not verify even though it was never revoked", () => {
  const clock = createClock("2026-01-01T12:00:00Z");
  const { db, dir, service, account } = withAccount(clock);

  const minted = service.mintToken({
    accountId: account.id,
    scopes: ["tickets:read"],
    expiresAt: new Date("2026-01-01T13:00:00Z")
  });

  assert.ok(service.verifyToken(minted.clearToken), "valid before it expires");

  clock.advanceSeconds(3600 + 1);

  const stored = db.prepare("SELECT * FROM service_tokens WHERE id = ?").get(minted.id);
  assert.equal(stored.revoked_at, null, "this must be expiry alone, not revocation");
  assert.equal(service.verifyToken(minted.clearToken), null);

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("minting with a scope outside the closed set is rejected by name", () => {
  const { db, dir, service, account } = withAccount();

  // A near-miss typo: plausible, and disastrous if it silently became a scope
  // no enforcement point knows how to check.
  assert.throws(
    () => service.mintToken({ accountId: account.id, scopes: ["tickets:reply"] }),
    (err) => {
      assert.equal(err.name, "ServiceAccountError");
      assert.equal(err.code, "UNKNOWN_SCOPE");
      assert.match(err.message, /tickets:reply/);
      return true;
    }
  );

  // Escalation attempts are the same failure, not a special case.
  assert.throws(
    () => service.mintToken({ accountId: account.id, scopes: ["tickets:read", "admin"] }),
    (err) => err.code === "UNKNOWN_SCOPE"
  );
  assert.throws(
    () => service.mintToken({ accountId: account.id, scopes: [] }),
    (err) => err.code === "EMPTY_SCOPES"
  );

  // Nothing was written by a rejected mint.
  assert.deepEqual(service.listTokens(account.id), []);

  // The vocabulary itself stays closed.
  assert.deepEqual(SERVICE_TOKEN_SCOPES, [
    "tickets:read",
    "tickets:comment",
    "tickets:propose_reply",
    "projects:read"
  ]);
  assert.throws(() => {
    SERVICE_TOKEN_SCOPES.push("tickets:delete");
  });

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the clear token cannot be recovered from the database", () => {
  const { db, dir, service, account } = withAccount();

  const minted = service.mintToken({ accountId: account.id, scopes: ["tickets:read"] });

  // Everything the database holds about every service account and token.
  const dump = JSON.stringify([
    db.prepare("SELECT * FROM service_tokens").all(),
    db.prepare("SELECT * FROM service_accounts").all()
  ]);
  assert.ok(!dump.includes(minted.clearToken), "no column may hold the clear token");

  const stored = db.prepare("SELECT * FROM service_tokens WHERE id = ?").get(minted.id);
  assert.equal(stored.token_hash, hashToken(minted.clearToken));
  // A hash, and a one-way one: the stored value is not the token in disguise.
  assert.match(stored.token_hash, /^[0-9a-f]{64}$/);
  assert.notEqual(
    Buffer.from(stored.token_hash, "hex").toString("utf8"),
    minted.clearToken
  );

  // Two mints with identical inputs still differ — the token is random, not
  // derived from the account.
  const second = service.mintToken({ accountId: account.id, scopes: ["tickets:read"] });
  assert.notEqual(second.clearToken, minted.clearToken);

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("last_used_at advances on a successful verification only", () => {
  const clock = createClock("2026-01-01T12:00:00Z");
  const { db, dir, service, account } = withAccount(clock);

  const minted = service.mintToken({ accountId: account.id, scopes: ["tickets:read"] });
  const readBack = () =>
    db.prepare("SELECT last_used_at FROM service_tokens WHERE id = ?").get(minted.id).last_used_at;

  assert.equal(readBack(), null, "an unused token has never been used");

  service.verifyToken(minted.clearToken);
  const firstUse = readBack();
  assert.ok(firstUse, "a successful verification records the use");

  clock.advanceSeconds(120);
  service.verifyToken(minted.clearToken);
  const secondUse = readBack();
  assert.ok(new Date(`${secondUse.replace(" ", "T")}Z`) > new Date(`${firstUse.replace(" ", "T")}Z`));

  // A failed presentation is not a use.
  clock.advanceSeconds(120);
  service.verifyToken("oa_wrong");
  assert.equal(readBack(), secondUse);

  clock.advanceSeconds(120);
  service.revokeToken(minted.id);
  service.verifyToken(minted.clearToken);
  assert.equal(readBack(), secondUse, "a revoked token's use is not recorded");

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("minting against an unknown account is rejected", () => {
  const { db, dir, service } = withAccount();

  assert.throws(
    () => service.mintToken({ accountId: "nope", scopes: ["tickets:read"] }),
    (err) => err.code === "UNKNOWN_ACCOUNT"
  );

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("tokens of a disabled account stop verifying through the same path", () => {
  const { db, dir, service, account } = withAccount();

  const minted = service.mintToken({ accountId: account.id, scopes: ["tickets:read"] });
  assert.ok(service.verifyToken(minted.clearToken));

  db.prepare("UPDATE service_accounts SET disabled_at = datetime('now') WHERE id = ?").run(
    account.id
  );

  assert.equal(service.verifyToken(minted.clearToken), null);

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
