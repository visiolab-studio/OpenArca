const path = require("path");
const fs = require("fs");
const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const { cleanupTestEnv, initTestEnv, loginByOtp, uniqueEmail } = require("./helpers");

// Releasing a draft crosses from the Enterprise layer INTO core's ticket
// service, and the layer holds a service object rather than an HTTP client to
// its own process. That boundary broke in production while every test was
// green: the layer called `publishTicketComment`, but `getService("ticketService")`
// returns the extension-facing surface, which exposes only `*ForExtension`
// methods. The layer's own tests could not catch it — they stub the service,
// so they mocked precisely the thing that was wrong.
//
// This test drives the REAL layer route against the REAL core service. It is
// the only shape of test that fails when that surface drifts.

// The layer lives in different places depending on where the suite runs: a
// sibling checkout on a developer's machine, a mount inside the container. An
// ambient EXTENSIONS_LAYERS is the most reliable answer, because it is what the
// app itself will load.
function findEnterpriseLayer() {
  const candidates = [
    ...String(process.env.EXTENSIONS_LAYERS || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    "/opt/openarca-enterprise",
    path.resolve(__dirname, "../../../OpenArca-Enterprise")
  ];

  return (
    candidates.find((dir) => fs.existsSync(path.join(dir, "backend/extensions/routes.js"))) || null
  );
}

const ENTERPRISE_LAYER = findEnterpriseLayer();

function resetAppModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}backend${path.sep}`)) {
      delete require.cache[key];
    }
  }
}

let envRoot;
let db;
let request;
let devAuth;
let ticketId;
let previousLayers;

const layerAvailable = Boolean(ENTERPRISE_LAYER);

test.before(async () => {
  if (!layerAvailable) return;

  const env = initTestEnv();
  envRoot = env.root;
  previousLayers = process.env.EXTENSIONS_LAYERS;
  process.env.EXTENSIONS_LAYERS = ENTERPRISE_LAYER;

  resetAppModules();
  const app = require("../app");
  db = require("../db");
  request = supertest(app);

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );
  const devEmail = uniqueEmail("dev-release");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );
  devAuth = await loginByOtp({ request, db, email: devEmail });

  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .field("title", "Zgloszenie do testu zwalniania szkicu")
    .field("description", "Tresc wystarczajaco dluga, zeby przejsc walidacje formularza zgloszenia.")
    .field("category", "question")
    .expect(201);
  ticketId = created.body.id;
});

test.after(() => {
  if (previousLayers === undefined) delete process.env.EXTENSIONS_LAYERS;
  else process.env.EXTENSIONS_LAYERS = previousLayers;
  if (envRoot) cleanupTestEnv(envRoot);
});

test("a developer can release a draft through the layer's own route", async (t) => {
  if (!layerAvailable) {
    t.skip("Enterprise layer checkout not present beside this repo");
    return;
  }

  const draft = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ content: "Szkic odpowiedzi dla zglaszajacego", is_internal: false, publish: false })
    .expect(201);

  const before = db.prepare("SELECT published_at FROM comments WHERE id = ?").get(draft.body.id);
  assert.equal(before.published_at, null, "precondition: the comment starts as a draft");

  const released = await request
    .post(`/api/enterprise/agents/replies/${ticketId}/${draft.body.id}/release`)
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(
    released.statusCode,
    200,
    `release failed (${released.statusCode}): ${JSON.stringify(released.body)}`
  );

  const after = db.prepare("SELECT published_at FROM comments WHERE id = ?").get(draft.body.id);
  assert.ok(after.published_at, "the draft must actually be published, not merely accepted");
});

test("a developer can discard a draft through the layer's own route", async (t) => {
  if (!layerAvailable) {
    t.skip("Enterprise layer checkout not present beside this repo");
    return;
  }

  const draft = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ content: "Szkic do odrzucenia", is_internal: false, publish: false })
    .expect(201);

  const discarded = await request
    .delete(`/api/enterprise/agents/replies/${ticketId}/${draft.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(
    discarded.statusCode,
    200,
    `discard failed (${discarded.statusCode}): ${JSON.stringify(discarded.body)}`
  );

  const gone = db.prepare("SELECT id FROM comments WHERE id = ?").get(draft.body.id);
  assert.equal(gone, undefined, "a discarded draft must not survive");
});
