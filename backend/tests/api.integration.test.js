const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
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

let userAuth;
let devAuth;
let userTicket;

test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;

  app = require("../app");
  db = require("../db");
  request = supertest(app);

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );

  const devEmail = uniqueEmail("dev");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );

  userAuth = await loginByOtp({
    request,
    db,
    email: uniqueEmail("user")
  });

  devAuth = await loginByOtp({ request, db, email: devEmail });

  const createTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(makeBugPayload());

  assert.equal(createTicket.statusCode, 201);
  userTicket = createTicket.body;
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

test("auth flow assigns proper roles and returns token", async () => {
  assert.ok(userAuth.token);
  assert.equal(userAuth.user.role, "user");

  assert.ok(devAuth.token);
  assert.equal(devAuth.user.role, "developer");
});

test("rbac blocks user from developer-only endpoint", async () => {
  const forbidden = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${userAuth.token}`);

  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.body.error, "forbidden");

  const allowed = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(allowed.statusCode, 200);
  assert.ok(Array.isArray(allowed.body.active));
  assert.ok(Array.isArray(allowed.body.done));
});

test("developer updates ticket and history is persisted", async () => {
  const patchResult = await request
    .patch(`/api/tickets/${userTicket.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      status: "in_progress",
      priority: "critical",
      planned_date: "2026-02-20"
    });

  assert.equal(patchResult.statusCode, 200);
  assert.equal(patchResult.body.status, "in_progress");
  assert.equal(patchResult.body.priority, "critical");

  const detail = await request
    .get(`/api/tickets/${userTicket.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`);

  assert.equal(detail.statusCode, 200);
  assert.ok(Array.isArray(detail.body.history));

  const historyFields = detail.body.history.map((item) => item.field);
  assert.ok(historyFields.includes("status"));
  assert.ok(historyFields.includes("priority"));
  assert.ok(historyFields.includes("planned_date"));
});

test("upload security rejects unsupported file type and enforces ownership", async () => {
  const badUpload = await request
    .post(`/api/tickets/${userTicket.id}/attachments`)
    .set("Authorization", `Bearer ${userAuth.token}`)
    .attach("attachments", Buffer.from("malicious"), {
      filename: "payload.exe",
      contentType: "application/x-msdownload"
    });

  assert.equal(badUpload.statusCode, 400);
  assert.equal(badUpload.body.error, "unsupported_file_type");

  const goodUpload = await request
    .post(`/api/tickets/${userTicket.id}/attachments`)
    .set("Authorization", `Bearer ${userAuth.token}`)
    .attach("attachments", Buffer.from("debug log"), {
      filename: "debug.txt",
      contentType: "text/plain"
    });

  assert.equal(goodUpload.statusCode, 201);
  assert.equal(goodUpload.body.length, 1);

  const [{ filename }] = goodUpload.body;

  const badFilename = await request
    .get("/api/uploads/not_valid$name.txt")
    .set("Authorization", `Bearer ${userAuth.token}`);

  assert.equal(badFilename.statusCode, 400);
  assert.equal(badFilename.body.error, "invalid_filename");

  const strangerAuth = await loginByOtp({
    request,
    db,
    email: uniqueEmail("stranger")
  });

  const forbidden = await request
    .get(`/api/uploads/${filename}`)
    .set("Authorization", `Bearer ${strangerAuth.token}`);

  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.body.error, "forbidden");

  const ownFile = await request
    .get(`/api/uploads/${filename}`)
    .set("Authorization", `Bearer ${userAuth.token}`);

  assert.equal(ownFile.statusCode, 200);
});

test("stored attachment file exists in uploads directory", () => {
  const row = db.prepare("SELECT filename FROM attachments ORDER BY created_at DESC LIMIT 1").get();
  assert.ok(row?.filename);
  const fullPath = path.join(process.env.UPLOADS_DIR, row.filename);
  assert.equal(fs.existsSync(fullPath), true);
});
