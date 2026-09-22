const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supertest = require("supertest");
const { cleanupTestEnv, initTestEnv, loginByOtp, uniqueEmail } = require("./helpers");

let envRoot;
let app;
let db;
let request;
let devAuth;
let userAuth;
let accounts;
let account;
let machineToken;
let probeRequest;

// The whole point of the phase in one sentence: the agent is bound to a named
// developer, runs on that developer's hardware, and must never be able to do
// what that developer can do just because it belongs to them.
test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;
  app = require("../app");
  db = require("../db");
  request = supertest(app);

  const { createServiceAccountsService } = require("../core/service-accounts");
  const { authRequired, requireRole, requireScope } = require("../middleware/auth");
  accounts = createServiceAccountsService({ db });

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );
  const devEmail = uniqueEmail("dev-machine");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );
  devAuth = await loginByOtp({ request, db, email: devEmail });
  userAuth = await loginByOtp({ request, db, email: uniqueEmail("user-machine") });

  account = accounts.create({
    name: "claude-code on Piotr's laptop",
    ownerUserId: devAuth.user.id,
    description: "local coding agent"
  });
  machineToken = accounts.mintToken({
    accountId: account.id,
    scopes: ["tickets:read", "tickets:comment"]
  }).clearToken;

  // A probe mounted on the REAL middleware: the only way to observe what a
  // handler actually receives, since no core handler echoes req.machine.
  const probe = express();
  probe.get("/probe", authRequired, (req, res) => {
    res.json({
      machine: req.machine
        ? {
            accountId: req.machine.account.id,
            accountName: req.machine.account.name,
            ownerId: req.machine.owner.id,
            ownerRole: req.machine.owner.role,
            scopes: req.machine.scopes
          }
        : null,
      user: req.user ? { id: req.user.id, role: req.user.role } : null
    });
  });
  probe.get("/role-gated", authRequired, requireRole("developer"), (req, res) => {
    res.json({ reached: true });
  });
  probe.get("/scope-gated", authRequired, requireScope("tickets:read"), (req, res) => {
    res.json({ reached: true });
  });
  probe.get(
    "/scope-gated-nonexistent",
    authRequired,
    requireScope("tickets:delete-everything"),
    (req, res) => {
      res.json({ reached: true });
    }
  );
  // No authRequired at all: exercises the middleware's own fail-closed
  // behaviour when neither req.machine nor req.user was ever set, rather than
  // relying on authRequired to have already turned that case into a 401.
  probe.get("/scope-gated-no-auth", requireScope("tickets:read"), (req, res) => {
    res.json({ reached: true });
  });
  probeRequest = supertest(probe);
});

test.after(() => cleanupTestEnv(envRoot));

test("a valid machine token reaches the handler with req.machine populated", async () => {
  const res = await probeRequest.get("/probe").set("Authorization", `Bearer ${machineToken}`);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.machine.accountId, account.id);
  assert.equal(res.body.machine.accountName, "claude-code on Piotr's laptop");
  assert.equal(res.body.machine.ownerId, devAuth.user.id);
  assert.deepEqual(res.body.machine.scopes, ["tickets:read", "tickets:comment"]);
});

test("req.user is shaped from the owner so handlers reading req.user.id keep working", async () => {
  const res = await probeRequest.get("/probe").set("Authorization", `Bearer ${machineToken}`);

  assert.equal(res.body.user.id, devAuth.user.id);
});

test("a machine token still reaches ordinary authRequired routes in the real app", async () => {
  const res = await request.get("/api/tickets").set("Authorization", `Bearer ${machineToken}`);

  assert.equal(res.statusCode, 200);
});

test("a human JWT never carries a machine identity", async () => {
  const res = await probeRequest.get("/probe").set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.machine, null);
  assert.equal(res.body.user.id, devAuth.user.id);
});

test("the owner's own role still opens a role gate for the owner", async () => {
  const res = await probeRequest.get("/role-gated").set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reached, true);
});

test("a non-developer human is still refused by the role gate", async () => {
  const res = await probeRequest.get("/role-gated").set("Authorization", `Bearer ${userAuth.token}`);

  assert.equal(res.statusCode, 403);
});

// The load-bearing half. The owner is a developer; every one of these routes
// answers 200 for them. The agent they own gets 403 on all of them.
test("a machine token is refused by every requireRole-gated route", async () => {
  const gated = [
    // personal data of every user in the install
    ["get", "/api/users"],
    // role changes
    ["patch", `/api/users/${devAuth.user.id}`],
    // ticket-scoped deletion
    ["delete", `/api/tickets/${devAuth.user.id}/external-references/${devAuth.user.id}`],
    ["get", "/api/tickets/board"],
    ["get", "/api/tickets/stats/usage"],
    ["get", "/api/settings"],
    ["get", "/api/dev-tasks"]
  ];

  for (const [method, path] of gated) {
    const machineRes = await request[method](path)
      .set("Authorization", `Bearer ${machineToken}`)
      .send(method === "patch" ? { role: "developer" } : undefined);

    assert.equal(machineRes.statusCode, 403, `${method.toUpperCase()} ${path} must refuse a machine`);
    assert.equal(machineRes.body.reason, "machine_identity");
  }
});

test("the owner is not locked out of the routes their agent is refused", async () => {
  const ownerRes = await request.get("/api/users").set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(ownerRes.statusCode, 200);
});

test("a machine token cannot escalate by asking for a role change on itself", async () => {
  const res = await request
    .patch(`/api/users/${devAuth.user.id}`)
    .set("Authorization", `Bearer ${machineToken}`)
    .send({ role: "developer" });

  assert.equal(res.statusCode, 403);
  const owner = db.prepare("SELECT role FROM users WHERE id = ?").get(devAuth.user.id);
  assert.equal(owner.role, "developer");
});

test("a token that was never minted is 401, not 500", async () => {
  const res = await probeRequest
    .get("/probe")
    .set("Authorization", "Bearer oa_thisWasNeverMintedAndDoesNotExist");

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "unauthorized");
});

test("a revoked token is 401, not 500", async () => {
  const minted = accounts.mintToken({ accountId: account.id, scopes: ["tickets:read"] });
  const before = await probeRequest
    .get("/probe")
    .set("Authorization", `Bearer ${minted.clearToken}`);
  assert.equal(before.statusCode, 200);

  assert.equal(accounts.revokeToken(minted.id), true);

  const after = await probeRequest
    .get("/probe")
    .set("Authorization", `Bearer ${minted.clearToken}`);
  assert.equal(after.statusCode, 401);
  assert.equal(after.body.error, "unauthorized");
});

test("an expired token is 401, not 500", async () => {
  const minted = accounts.mintToken({
    accountId: account.id,
    scopes: ["tickets:read"],
    expiresAt: new Date(Date.now() - 60_000)
  });

  const res = await probeRequest
    .get("/probe")
    .set("Authorization", `Bearer ${minted.clearToken}`);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "unauthorized");
});

test("a token of a disabled account is 401, not 500", async () => {
  const disabled = accounts.create({
    name: "retired agent",
    ownerUserId: devAuth.user.id
  });
  const minted = accounts.mintToken({ accountId: disabled.id, scopes: ["tickets:read"] });

  db.prepare("UPDATE service_accounts SET disabled_at = datetime('now') WHERE id = ?").run(
    disabled.id
  );

  const res = await probeRequest
    .get("/probe")
    .set("Authorization", `Bearer ${minted.clearToken}`);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "unauthorized");
});

test("a machine token with the required scope passes requireScope", async () => {
  const res = await probeRequest
    .get("/scope-gated")
    .set("Authorization", `Bearer ${machineToken}`);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reached, true);
});

test("a machine token without the required scope gets 403 naming the missing scope", async () => {
  const res = await probeRequest
    .get("/scope-gated-nonexistent")
    .set("Authorization", `Bearer ${machineToken}`);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "forbidden");
  assert.equal(res.body.scope, "tickets:delete-everything");
});

test("a human developer JWT passes a scoped route without holding any scope", async () => {
  const res = await probeRequest
    .get("/scope-gated-nonexistent")
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reached, true);
});

test("an unauthenticated request to a scoped route is 401, not 403", async () => {
  const res = await probeRequest.get("/scope-gated");

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "unauthorized");
});

test("requireScope denies when neither req.machine nor req.user was ever set", async () => {
  const res = await probeRequest.get("/scope-gated-no-auth");

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "unauthorized");
});

test("requireScope is exposed to layers via context.middlewares", () => {
  const { requireScope } = require("../middleware/auth");
  assert.equal(typeof requireScope, "function");
  assert.equal(typeof requireScope("tickets:read"), "function");
});

test("a machine-looking value is never accepted as a JWT, and a JWT never as a token", async () => {
  const jwtWithPrefix = await probeRequest
    .get("/probe")
    .set("Authorization", `Bearer oa_${devAuth.token}`);
  assert.equal(jwtWithPrefix.statusCode, 401);

  const tokenWithoutPrefix = await probeRequest
    .get("/probe")
    .set("Authorization", `Bearer ${machineToken.slice(3)}`);
  assert.equal(tokenWithoutPrefix.statusCode, 401);
});


// Zakresy musza byc egzekwowane na TRASIE, nie tylko istniec w slowniku.
// Bez tego token wydany do odczytu moglby komentowac, a zakres bylby ozdoba.
async function createTicketAsDeveloper() {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .field("title", "Zgloszenie do testu zakresow")
    .field("description", "Tresc wystarczajaco dluga, zeby przejsc walidacje formularza zgloszenia.")
    .field("category", "question")
    .expect(201);
  return created.body.id;
}

test("a read-only machine token cannot post a comment", async () => {
  const ticketId = await createTicketAsDeveloper();
  const readOnly = accounts.mintToken({
    accountId: account.id,
    scopes: ["tickets:read"]
  }).clearToken;

  const response = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${readOnly}`)
    .send({ content: "analiza od agenta", is_internal: true })
    .expect(403);

  assert.equal(response.body.reason, "missing_scope");
  assert.equal(response.body.scope, "tickets:comment");
});

test("tickets:comment allows an internal note but not a reporter-facing one", async () => {
  const ticketId = await createTicketAsDeveloper();

  await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${machineToken}`)
    .send({ content: "notatka wewnetrzna agenta", is_internal: true })
    .expect(201);

  // Tresc widoczna dla zglaszajacego to inna klasa dzialania i ma wlasny zakres.
  const refused = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${machineToken}`)
    .send({ content: "propozycja odpowiedzi", is_internal: false, publish: false })
    .expect(403);

  assert.equal(refused.body.scope, "tickets:propose_reply");
});

test("a machine holding tickets:propose_reply may draft a reporter-facing reply", async () => {
  const ticketId = await createTicketAsDeveloper();
  const proposer = accounts.mintToken({
    accountId: account.id,
    scopes: ["tickets:read", "tickets:comment", "tickets:propose_reply"]
  }).clearToken;

  await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${proposer}`)
    .send({ content: "propozycja odpowiedzi dla klienta", is_internal: false, publish: false })
    .expect(201);
});

test("a human developer is unaffected by scope gates", async () => {
  const ticketId = await createTicketAsDeveloper();
  await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ content: "odpowiedz czlowieka dla zglaszajacego", is_internal: false })
    .expect(201);
});

// Granica calego modulu: cokolwiek zobaczy zglaszajacy, zwalnia czlowiek.
// Sam zakres tego nie zalatwial — pozwalal pisac do zglaszajacego, a `publish`
// domyslnie jest `true`.
test("a machine cannot publish a reporter-facing comment, even asking explicitly", async () => {
  const ticketId = await createTicketAsDeveloper();
  const proposer = accounts.mintToken({
    accountId: account.id,
    scopes: ["tickets:read", "tickets:comment", "tickets:propose_reply"]
  }).clearToken;

  const created = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${proposer}`)
    .send({ content: "odpowiedz prosto do klienta", is_internal: false, publish: true })
    .expect(201);

  const stored = db
    .prepare("SELECT published_at, author_kind FROM comments WHERE id = ?")
    .get(created.body.id);

  assert.equal(stored.author_kind, "machine");
  assert.equal(stored.published_at, null, "maszyna nie moze opublikowac tresci dla zglaszajacego");
});

test("a human developer may still publish a reporter-facing comment directly", async () => {
  const ticketId = await createTicketAsDeveloper();
  const created = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ content: "odpowiedz czlowieka od razu widoczna", is_internal: false, publish: true })
    .expect(201);

  const stored = db.prepare("SELECT published_at FROM comments WHERE id = ?").get(created.body.id);
  assert.ok(stored.published_at, "czlowiek nie podlega tej bramce");
});
