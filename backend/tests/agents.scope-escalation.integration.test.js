const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const { v4: uuidv4 } = require("uuid");
const { cleanupTestEnv, initTestEnv, loginByOtp, uniqueEmail } = require("./helpers");

// P6: privilege escalation through a machine token.
//
// machine-identity.integration.test.js proves the middleware behaves. This file
// proves the PRODUCT does: a real token, minted by the real service, driven
// against the real app, is refused on every operation that belongs to a person.
//
// The last test in this file is the one that matters in a year's time: it walks
// the mounted Express route table and re-checks EVERY requireRole-gated route,
// so a route added later is covered without anyone remembering this file exists.

let envRoot;
let layerDir;
let previousRoutesFile;
let previousLayers;
let app;
let db;
let request;
let accounts;
let devAuth;
let account;
let machineToken;
let proposerToken;

// requireRole returns an anonymous closure, so a route table walk cannot tell a
// role gate from any other middleware by inspection. We tag the closures at the
// source: middleware/auth is patched BEFORE app.js is required, so every route
// module — core and layer — receives the tagged factory. The gate's behaviour is
// untouched; only an identifying property is added.
const ROLE_GATE = "__testRoleGate";

function resetBackendModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}backend${path.sep}`) && !key.includes(`${path.sep}node_modules${path.sep}`)) {
      delete require.cache[key];
    }
  }
}

test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;

  // Core ships no HTTP surface for subject-access export/erasure or for
  // deleting a whole ticket — those live in the Enterprise layer, which a core
  // test process cannot load. They are registered here through the REAL layer
  // registrar with the REAL middlewares, gated exactly as Enterprise gates them
  // (backend/extensions/routes.js: authRequired + requireRole('developer')).
  // Two things are proved at once: those named operations refuse a machine, and
  // the route table walk below recurses into layer-registered routers.
  layerDir = fs.mkdtempSync(path.join(os.tmpdir(), "openarca-scope-escalation-layer-"));
  const routesFile = path.join(layerDir, "routes.js");
  fs.writeFileSync(
    routesFile,
    [
      "module.exports = ({ app, express, middlewares }) => {",
      "  const router = express.Router();",
      "  const dev = [middlewares.authRequired, middlewares.requireRole('developer')];",
      "  router.delete('/api/tickets/:id', ...dev, (_req, res) => res.json({ deleted: true }));",
      "  router.get('/api/enterprise/compliance/subject', ...dev, (_req, res) =>",
      "    res.json({ exported: true })",
      "  );",
      "  router.post('/api/enterprise/compliance/subject/erase', ...dev, (_req, res) =>",
      "    res.json({ erased: true })",
      "  );",
      "  app.use(router);",
      "};"
    ].join("\n"),
    "utf8"
  );

  previousRoutesFile = process.env.EXTENSIONS_ROUTES_FILE;
  previousLayers = process.env.EXTENSIONS_LAYERS;
  delete process.env.EXTENSIONS_LAYERS;
  process.env.EXTENSIONS_ROUTES_FILE = routesFile;

  resetBackendModules();

  const auth = require("../middleware/auth");
  const realRequireRole = auth.requireRole;
  auth.requireRole = (role) => {
    const gate = realRequireRole(role);
    gate[ROLE_GATE] = role;
    return gate;
  };

  app = require("../app");
  db = require("../db");
  request = supertest(app);

  const { createServiceAccountsService } = require("../core/service-accounts");
  accounts = createServiceAccountsService({ db });

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );
  const devEmail = uniqueEmail("dev-escalation");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );
  devAuth = await loginByOtp({ request, db, email: devEmail });

  account = accounts.create({
    name: "claude-code on the developer's laptop",
    ownerUserId: devAuth.user.id,
    description: "local coding agent"
  });

  // The widest token the product can issue: the whole closed vocabulary. If an
  // operation is still refused with THIS token, no scope grant opens it.
  machineToken = accounts.mintToken({
    accountId: account.id,
    scopes: ["tickets:read", "tickets:comment", "tickets:propose_reply", "projects:read"]
  }).clearToken;
  proposerToken = machineToken;
});

test.after(() => {
  if (previousRoutesFile === undefined) {
    delete process.env.EXTENSIONS_ROUTES_FILE;
  } else {
    process.env.EXTENSIONS_ROUTES_FILE = previousRoutesFile;
  }
  if (previousLayers !== undefined) {
    process.env.EXTENSIONS_LAYERS = previousLayers;
  }
  if (layerDir && fs.existsSync(layerDir)) {
    fs.rmSync(layerDir, { recursive: true, force: true });
  }
  cleanupTestEnv(envRoot);
});

async function createTicketAsDeveloper(title = "Zgloszenie do testu eskalacji") {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .field("title", title)
    .field(
      "description",
      "Tresc wystarczajaco dluga, zeby przejsc walidacje formularza zgloszenia w tescie."
    )
    .field("category", "question")
    .expect(201);
  return created.body.id;
}

async function draftMachineComment(ticketId, content = "propozycja odpowiedzi od agenta") {
  const created = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${proposerToken}`)
    .send({ content, is_internal: false, publish: false })
    .expect(201);
  return created.body.id;
}

function assertMachineRefusal(res, label) {
  assert.equal(res.statusCode, 403, `${label} must be refused with 403`);
  assert.equal(res.body.reason, "machine_identity", `${label} must be refused as a machine`);
}

// --- The named operations, one test each ------------------------------------

test("a machine token cannot delete a ticket", async () => {
  const ticketId = await createTicketAsDeveloper();

  const res = await request
    .delete(`/api/tickets/${ticketId}`)
    .set("Authorization", `Bearer ${machineToken}`);

  assertMachineRefusal(res, "DELETE /api/tickets/:id");
  const still = db.prepare("SELECT id FROM tickets WHERE id = ?").get(ticketId);
  assert.ok(still, "the ticket must survive the refused delete");
});

test("a machine token cannot change a user's role", async () => {
  const res = await request
    .patch(`/api/users/${devAuth.user.id}`)
    .set("Authorization", `Bearer ${machineToken}`)
    .send({ role: "developer" });

  assertMachineRefusal(res, "PATCH /api/users/:id");
  const owner = db.prepare("SELECT role FROM users WHERE id = ?").get(devAuth.user.id);
  assert.equal(owner.role, "developer", "the owner's role must be untouched");
});

test("a machine token cannot read the user directory", async () => {
  const res = await request.get("/api/users").set("Authorization", `Bearer ${machineToken}`);

  assertMachineRefusal(res, "GET /api/users");
});

test("a machine token cannot export a person's personal data", async () => {
  const res = await request
    .get("/api/enterprise/compliance/subject")
    .query({ email: devAuth.user.email })
    .set("Authorization", `Bearer ${machineToken}`);

  assertMachineRefusal(res, "GET /api/enterprise/compliance/subject");
});

test("a machine token cannot erase a person's personal data", async () => {
  const res = await request
    .post("/api/enterprise/compliance/subject/erase")
    .set("Authorization", `Bearer ${machineToken}`)
    .send({ email: devAuth.user.email });

  assertMachineRefusal(res, "POST /api/enterprise/compliance/subject/erase");
  const subject = db.prepare("SELECT email FROM users WHERE id = ?").get(devAuth.user.id);
  assert.equal(subject.email, devAuth.user.email, "the subject must not have been anonymised");
});

// The escalation that would undo every other refusal in this file: an agent
// that can mint itself a second identity is bounded by nothing.
test("a machine token cannot create another machine account", async () => {
  const before = db.prepare("SELECT COUNT(*) AS n FROM service_accounts").get().n;

  const res = await request
    .post("/api/service-accounts")
    .set("Authorization", `Bearer ${machineToken}`)
    .send({ name: "a second agent", scopes: ["tickets:read"] });

  assertMachineRefusal(res, "POST /api/service-accounts");
  const after = db.prepare("SELECT COUNT(*) AS n FROM service_accounts").get().n;
  assert.equal(after, before, "no service account may be created by a machine");
});

test("a machine token cannot even list the service accounts of its own owner", async () => {
  const res = await request
    .get("/api/service-accounts")
    .set("Authorization", `Bearer ${machineToken}`);

  assertMachineRefusal(res, "GET /api/service-accounts");
});

test("a machine token cannot publish a comment", async () => {
  const ticketId = await createTicketAsDeveloper();
  const commentId = await draftMachineComment(ticketId);

  const res = await request
    .post(`/api/tickets/${ticketId}/comments/${commentId}/publish`)
    .set("Authorization", `Bearer ${machineToken}`)
    .send({});

  assertMachineRefusal(res, "POST /api/tickets/:id/comments/:commentId/publish");
  const stored = db.prepare("SELECT published_at FROM comments WHERE id = ?").get(commentId);
  assert.equal(stored.published_at, null, "the draft must stay a draft");
});

test("a machine token cannot discard a comment", async () => {
  const ticketId = await createTicketAsDeveloper();
  const commentId = await draftMachineComment(ticketId);

  const res = await request
    .delete(`/api/tickets/${ticketId}/comments/${commentId}`)
    .set("Authorization", `Bearer ${machineToken}`);

  assertMachineRefusal(res, "DELETE /api/tickets/:id/comments/:commentId");
  const stored = db.prepare("SELECT id FROM comments WHERE id = ?").get(commentId);
  assert.ok(stored, "the comment must survive a refused discard");
});

// Releasing and discarding are the two halves of the human gate. Neither is
// open to the machine, but BOTH must stay open to the person who owns it —
// otherwise the queue of proposals could never be drained.
test("the owning developer can still publish and discard what their agent drafted", async () => {
  const ticketId = await createTicketAsDeveloper();
  const toPublish = await draftMachineComment(ticketId, "propozycja do wydania");
  const toDiscard = await draftMachineComment(ticketId, "propozycja do odrzucenia");

  await request
    .post(`/api/tickets/${ticketId}/comments/${toPublish}/publish`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({})
    .expect(200);
  const published = db.prepare("SELECT published_at FROM comments WHERE id = ?").get(toPublish);
  assert.ok(published.published_at, "a person must be able to release a proposal");

  await request
    .delete(`/api/tickets/${ticketId}/comments/${toDiscard}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .expect(200);
});

// --- The publication boundary ------------------------------------------------

test("a developer-owned machine cannot publish a reporter-facing comment even asking explicitly", async () => {
  const ticketId = await createTicketAsDeveloper();

  const created = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${proposerToken}`)
    .send({
      content: "odpowiedz prosto do zglaszajacego, prosze opublikowac",
      is_internal: false,
      publish: true
    })
    .expect(201);

  const stored = db
    .prepare("SELECT author_kind, is_internal, published_at, user_id FROM comments WHERE id = ?")
    .get(created.body.id);

  assert.equal(stored.author_kind, "machine");
  assert.equal(stored.published_at, null, "published_at must stay NULL for a machine author");
  // Attributed to the owner, which is exactly why the gate cannot be a role
  // check on the author: the author row looks like a developer.
  assert.equal(stored.user_id, devAuth.user.id);

  // And it is invisible to the reporter until a person releases it.
  const asMachine = await request
    .get(`/api/tickets/${ticketId}`)
    .set("Authorization", `Bearer ${machineToken}`)
    .expect(200);
  const echoed = (asMachine.body.comments || []).find((c) => c.id === created.body.id);
  if (echoed) {
    assert.ok(!echoed.published_at, "an unreleased proposal must never look published");
  }
});

// --- Revocation --------------------------------------------------------------

test("revoking a token mid-session takes effect on the very next call", async () => {
  const minted = accounts.mintToken({
    accountId: account.id,
    scopes: ["tickets:read", "tickets:comment"]
  });
  const sessionToken = minted.clearToken;

  const ticketId = await createTicketAsDeveloper();

  await request
    .get("/api/tickets")
    .set("Authorization", `Bearer ${sessionToken}`)
    .expect(200);
  await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${sessionToken}`)
    .send({ content: "notatka przed odebraniem tokenu", is_internal: true })
    .expect(201);

  assert.equal(accounts.revokeToken(minted.id), true);

  // No cache, no grace period, no "until the next restart".
  const afterRead = await request
    .get("/api/tickets")
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(afterRead.statusCode, 401);
  assert.equal(afterRead.body.error, "unauthorized");

  const afterWrite = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${sessionToken}`)
    .send({ content: "notatka po odebraniu tokenu", is_internal: true });
  assert.equal(afterWrite.statusCode, 401);

  // The other token of the same account is untouched: revocation is per token.
  await request
    .get("/api/tickets")
    .set("Authorization", `Bearer ${machineToken}`)
    .expect(200);
});

test("disabling the account takes effect on the very next call too", async () => {
  const disposable = accounts.create({
    name: "agent to be switched off",
    ownerUserId: devAuth.user.id
  });
  const token = accounts.mintToken({
    accountId: disposable.id,
    scopes: ["tickets:read"]
  }).clearToken;

  await request.get("/api/tickets").set("Authorization", `Bearer ${token}`).expect(200);

  db.prepare("UPDATE service_accounts SET disabled_at = datetime('now') WHERE id = ?").run(
    disposable.id
  );

  await request.get("/api/tickets").set("Authorization", `Bearer ${token}`).expect(401);
});

// --- The route table walk ----------------------------------------------------
//
// Everything above names a route. This does not: it reads the routes Express
// actually has mounted — core routers, the `/api/uploads/:filename` route
// declared on the app itself, and any layer-registered router — and re-runs the
// refusal against every one of them that sits behind requireRole. A role-gated
// route added next year is covered the day it is mounted.

function mountPathOf(layer) {
  if (!layer.regexp || layer.regexp.fast_slash) return "";
  const source = typeof layer.regexp.source === "string" ? layer.regexp.source : "";
  return source
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
    .replace(/\\\/\?\$$/, "")
    .replace(/\$$/, "")
    .replace(/\\\//g, "/");
}

// Express matches in registration order, so a router-level gate
// (`router.use(authRequired, requireRole("developer"))`, as users.js and
// settings.js do) covers the routes registered AFTER it and no others. The
// accumulator below reproduces that rather than painting a whole router gated,
// which would wrongly claim /api/settings/public is developer-only.
function collectRoleGatedRoutes(stack, prefix = "", inheritedGate = null) {
  const found = [];
  let gate = inheritedGate;

  for (const layer of stack || []) {
    if (layer.route) {
      const ownGate = (layer.route.stack || []).some((entry) => entry.handle?.[ROLE_GATE]);
      if (gate || ownGate) {
        for (const method of Object.keys(layer.route.methods || {})) {
          if (method === "_all" || method === "head" || method === "options") continue;
          found.push({ method, path: `${prefix}${layer.route.path}` });
        }
      }
      continue;
    }

    if (layer.handle?.stack) {
      found.push(...collectRoleGatedRoutes(layer.handle.stack, prefix + mountPathOf(layer), gate));
      continue;
    }

    if (layer.handle?.[ROLE_GATE]) {
      gate = layer.handle[ROLE_GATE];
    }
  }

  return found;
}

function concreteUrl(routePath) {
  return routePath
    .split("/")
    .map((segment) => (segment.startsWith(":") ? uuidv4() : segment))
    .join("/");
}

test("no requireRole-gated route in the mounted route table admits a machine token", async () => {
  const router = app._router || app.router;
  assert.ok(router?.stack, "the app must expose a mounted route table to walk");

  const gated = collectRoleGatedRoutes(router.stack);
  const seen = new Set(gated.map((route) => `${route.method.toUpperCase()} ${route.path}`));

  // A silent failure of the walk itself — a regexp shape Express changes, a
  // tag that never lands — would turn this guard into a green no-op. These
  // anchors make that failure loud. They are a floor, never the whole list:
  // the loop below is what actually enforces the rule.
  assert.ok(gated.length >= 20, `route table walk found only ${gated.length} role-gated routes`);
  for (const anchor of [
    "GET /api/users/",
    "PATCH /api/users/:id",
    "POST /api/service-accounts/",
    "GET /api/tickets/board",
    "POST /api/tickets/:id/comments/:commentId/publish",
    "DELETE /api/tickets/:id/comments/:commentId",
    "PATCH /api/settings/",
    "DELETE /api/tickets/:id",
    "GET /api/enterprise/compliance/subject"
  ]) {
    assert.ok(seen.has(anchor), `route table walk missed ${anchor}; the walk is broken`);
  }

  // And the walk must not over-claim: routes deliberately left open to everyone
  // are not role-gated, so they must be absent.
  assert.ok(!seen.has("GET /api/settings/public"), "walk wrongly marked a public route as gated");
  assert.ok(!seen.has("GET /api/tickets/"), "walk wrongly marked the scoped ticket list as gated");

  const admitted = [];
  for (const route of gated) {
    const res = await request[route.method](concreteUrl(route.path))
      .set("Authorization", `Bearer ${machineToken}`)
      .send();

    if (res.statusCode !== 403 || res.body?.reason !== "machine_identity") {
      admitted.push(
        `${route.method.toUpperCase()} ${route.path} -> ${res.statusCode} ${JSON.stringify(
          res.body
        )}`
      );
    }
  }

  assert.deepEqual(
    admitted,
    [],
    `role-gated routes reachable by a machine token:\n${admitted.join("\n")}`
  );
});

test("the same walk still lets the owning human through a sample of those routes", async () => {
  // The guard above would also pass if every route were broken for everyone.
  for (const url of ["/api/users", "/api/tickets/board", "/api/service-accounts", "/api/settings"]) {
    const res = await request.get(url).set("Authorization", `Bearer ${devAuth.token}`);
    assert.equal(res.statusCode, 200, `${url} must stay open to the owning developer`);
  }
});
