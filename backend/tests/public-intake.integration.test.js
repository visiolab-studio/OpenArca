const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const { cleanupTestEnv, initTestEnv, loginByOtp, uniqueEmail } = require("./helpers");

let envRoot;
let app;
let db;
let request;
let devAuth;
let publicProjectId;
let privateProjectId;

function validSubmission(overrides = {}) {
  return {
    project_id: publicProjectId,
    email: uniqueEmail("visitor"),
    title: "Nie moge pobrac zakupionego materialu",
    description:
      "Po zakupie materialu przycisk pobierania zwraca blad i plik nie jest pobierany. " +
      "Probowalam na dwoch przegladarkach i telefonie, za kazdym razem to samo.",
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
  const devEmail = uniqueEmail("dev-public");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );
  devAuth = await loginByOtp({ request, db, email: devEmail });

  const publicProject = await request
    .post("/api/projects")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ name: "Public desk" });
  publicProjectId = publicProject.body.id;
  db.prepare("UPDATE projects SET public_intake_enabled = 1 WHERE id = ?").run(publicProjectId);

  const privateProject = await request
    .post("/api/projects")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ name: "Internal only" });
  privateProjectId = privateProject.body.id;
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

test("a visitor with no session can submit to an enabled project", async () => {
  const response = await request.post("/api/public/intake").send(validSubmission());

  assert.equal(response.statusCode, 201);
  assert.match(response.body.reference, /^#\d{3,}$/);
});

test("only the reference comes back, never the stored ticket", async () => {
  const response = await request.post("/api/public/intake").send(validSubmission());

  // Echoing the ticket would let anyone confirm what was stored for an address
  // that is not theirs.
  assert.deepEqual(Object.keys(response.body), ["reference"]);
});

test("a project without public intake is not reachable", async () => {
  const response = await request
    .post("/api/public/intake")
    .send(validSubmission({ project_id: privateProjectId }));

  assert.equal(response.statusCode, 404);
});

test("a private project and a missing project answer identically", async () => {
  const privateProbe = await request.get(`/api/public/projects/${privateProjectId}`);
  const missingProbe = await request.get(
    "/api/public/projects/00000000-0000-0000-0000-000000000000"
  );

  // Otherwise this endpoint enumerates private projects.
  assert.equal(privateProbe.statusCode, 404);
  assert.equal(missingProbe.statusCode, 404);
  assert.deepEqual(privateProbe.body, missingProbe.body);
});

test("the public project endpoint exposes only what a form needs", async () => {
  const response = await request.get(`/api/public/projects/${publicProjectId}`);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ["custom_fields", "id", "name"]);
});

test("a submitter cannot choose status, priority or assignee", async () => {
  const response = await request
    .post("/api/public/intake")
    .send({ ...validSubmission(), status: "closed", priority: "critical", assignee_id: "x" });

  // Strict schema: unknown keys are refused outright rather than ignored, so a
  // submitter cannot discover which ones are silently accepted.
  assert.equal(response.statusCode, 400);
});

test("a submitted ticket lands as a normal new ticket", async () => {
  const email = uniqueEmail("visitor-state");
  const created = await request.post("/api/public/intake").send(validSubmission({ email }));
  assert.equal(created.statusCode, 201);

  const number = Number(created.body.reference.replace("#", ""));
  const ticket = db.prepare("SELECT status, priority, category FROM tickets WHERE number = ?").get(number);

  assert.equal(ticket.status, "submitted");
  assert.equal(ticket.priority, "normal");
  assert.equal(ticket.category, "other");
});

test("a submitter becomes a reporter but gains no access", async () => {
  const email = uniqueEmail("visitor-user");
  await request.post("/api/public/intake").send(validSubmission({ email }));

  const user = db.prepare("SELECT role FROM users WHERE email = ?").get(email.toLowerCase());
  assert.equal(user.role, "user");

  // Creating the record must not become a way in: login still goes through OTP
  // and the domain allowlist, which this address does not satisfy.
  const otp = await request
    .post("/api/auth/request-otp")
    .send({ email: "outsider@not-allowed.test", lang: "pl" });
  assert.notEqual(otp.statusCode, 200);
});

test("markup in submitted content is stored as text, not markup", async () => {
  const email = uniqueEmail("visitor-xss");
  const payload = "<script>alert(1)</script> nie dziala pobieranie materialu po zakupie u mnie";

  const created = await request
    .post("/api/public/intake")
    .send(validSubmission({ email, description: payload.repeat(2) }));
  assert.equal(created.statusCode, 201);

  const number = Number(created.body.reference.replace("#", ""));
  const ticket = db.prepare("SELECT description FROM tickets WHERE number = ?").get(number);

  // Stored verbatim; escaping is the renderer's job, and storing a mangled
  // version would lose what the person actually wrote.
  assert.ok(ticket.description.includes("<script>"));
});

test("a too-short report is refused", async () => {
  const short = await request
    .post("/api/public/intake")
    .send(validSubmission({ title: "blad", description: "nie dziala" }));

  assert.equal(short.statusCode, 400);
});

test("a malformed email is refused", async () => {
  const response = await request
    .post("/api/public/intake")
    .send(validSubmission({ email: "not-an-email" }));

  assert.equal(response.statusCode, 400);
});

test("repeated submissions from one address are rate limited", async () => {
  const email = uniqueEmail("visitor-flood");
  const codes = [];

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await request.post("/api/public/intake").send(validSubmission({ email }));
    codes.push(response.statusCode);
  }

  assert.ok(
    codes.includes(429),
    `expected a 429 among ${codes.join(", ")} — the email axis is not limiting`
  );
});
