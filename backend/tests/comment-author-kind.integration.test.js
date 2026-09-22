const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const {
  cleanupTestEnv,
  initTestEnv,
  loginByOtp,
  makeBugPayload,
  uniqueEmail
} = require("./helpers");

let envRoot;
let app;
let db;
let request;
let devAuth;
let ticketId;
let machineToken;

// author_kind must reflect who/what actually authenticated, never a claim in
// the request body: a machine writing 'human' would let a wrong analysis be
// relayed to a customer as a human answer, and a human writing 'machine'
// would let a person disclaim their own comment.
test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;
  app = require("../app");
  db = require("../db");
  request = supertest(app);

  const { createServiceAccountsService } = require("../core/service-accounts");
  const accounts = createServiceAccountsService({ db });

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );
  const devEmail = uniqueEmail("dev-author-kind");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );

  devAuth = await loginByOtp({ request, db, email: devEmail });

  const createTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .field(makeBugPayload());
  assert.equal(createTicket.statusCode, 201);
  ticketId = createTicket.body.id;

  const account = accounts.create({
    name: "test agent",
    ownerUserId: devAuth.user.id,
    description: "test"
  });
  machineToken = accounts.mintToken({
    accountId: account.id,
    // Pelny zestaw: ten plik bada widocznosc i autorstwo, a nie zakresy.
    // Egzekwowanie zakresow ma wlasne testy w machine-identity.integration.test.js.
    scopes: ["tickets:read", "tickets:comment", "tickets:propose_reply"]
  }).clearToken;
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

test("comment created under a machine token is stored as author_kind='machine'", async () => {
  const res = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${machineToken}`)
    .send({ content: "Drafted analysis from an agent." });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.author_kind, "machine");

  const row = db.prepare("SELECT author_kind FROM comments WHERE id = ?").get(res.body.id);
  assert.equal(row.author_kind, "machine");
});

test("comment created under a human JWT is stored as author_kind='human' even if the body claims otherwise", async () => {
  const res = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ content: "A normal human comment.", author_kind: "machine" });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.author_kind, "human");

  const row = db.prepare("SELECT author_kind FROM comments WHERE id = ?").get(res.body.id);
  assert.equal(row.author_kind, "human");
});

test("existing comments (predating the column) read back as author_kind='human'", async () => {
  const res = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ content: "Plain comment, no author_kind sent." });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.author_kind, "human");
});
