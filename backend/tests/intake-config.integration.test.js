const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const { cleanupTestEnv, initTestEnv, loginByOtp, uniqueEmail } = require("./helpers");

let envRoot;
let app;
let db;
let request;
let devAuth;
let relaxedProjectId;
let strictProjectId;

// A report as support actually writes it: the customer's words, no "steps to
// reproduce", no "expected result". Every real report in the source chat looks
// like this.
function supportStyleReport(overrides = {}) {
  return {
    title: "Klientka nie moze pobrac zakupionego materialu",
    description:
      "Klientka pisze, ze po zakupie przycisk pobierania zwraca blad i plik sie nie pobiera.",
    category: "bug",
    ...overrides
  };
}

test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;
  app = require("../app");
  db = require("../db");
  request = supertest(app);

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );
  const devEmail = uniqueEmail("dev-intake");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );
  devAuth = await loginByOtp({ request, db, email: devEmail });

  const relaxed = await request
    .post("/api/projects")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ name: "Obsluga klienta" });
  relaxedProjectId = relaxed.body.id;
  db.prepare("UPDATE projects SET require_bug_details = 0 WHERE id = ?").run(relaxedProjectId);

  const strict = await request
    .post("/api/projects")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ name: "Wewnetrzny" });
  strictProjectId = strict.body.id;
});

test.after(() => cleanupTestEnv(envRoot));

test("support can file a bug without inventing reproduction steps", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send(supportStyleReport({ project_id: relaxedProjectId }));

  assert.equal(created.statusCode, 201);
});

test("the same report is refused by a project that kept the strict rules", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send(supportStyleReport({ project_id: strictProjectId }));

  // This is what protects existing installations: nothing changes for them.
  assert.equal(created.statusCode, 400);
});

test("a project with no configuration keeps the built-in categories", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      title: "Pytanie o dzialanie kategorii w sklepie",
      description: "Chcialbym wiedziec, jak dzialaja kategorie w sklepie internetowym.",
      category: "question",
      project_id: relaxedProjectId
    });

  assert.equal(created.statusCode, 201);
});

test("a custom taxonomy replaces the built-ins", async () => {
  const { createCategoriesService } = require("../core/categories");
  const categories = createCategoriesService({ db });

  categories.upsert({
    projectId: relaxedProjectId,
    payload: { category_key: "data_check", label: "Sprawdzenie danych", position: 0 }
  });

  const accepted = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      title: "Prosze sprawdzic zamowienie klientki",
      description: "Klientka zglasza rozbieznosc w liczbie dostepnych materialow.",
      category: "data_check",
      project_id: relaxedProjectId
    });
  assert.equal(accepted.statusCode, 201);

  const refused = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send(supportStyleReport({ project_id: relaxedProjectId, category: "improvement" }));

  assert.equal(refused.statusCode, 400);
  assert.equal(refused.body.error, "invalid_category");
  assert.match(refused.body.message || refused.body.details?.[0]?.message || "", /data_check/);
});
