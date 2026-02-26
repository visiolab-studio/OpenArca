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
let request;
let db;
let userAuth;
let secondUserAuth;
let devAuth;

test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;

  const app = require("../app");
  db = require("../db");
  request = supertest(app);

  const developerEmail = uniqueEmail("dev");

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([developerEmail])
  );

  userAuth = await loginByOtp({
    request,
    db,
    email: uniqueEmail("user")
  });
  secondUserAuth = await loginByOtp({
    request,
    db,
    email: uniqueEmail("other")
  });
  devAuth = await loginByOtp({
    request,
    db,
    email: developerEmail
  });
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

test("rbac audit: user cannot access developer-only write endpoints", async () => {
  const projectCreateDenied = await request
    .post("/api/projects")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .send({ name: "Unauthorized project create attempt" });
  assert.equal(projectCreateDenied.statusCode, 403);
  assert.equal(projectCreateDenied.body.error, "forbidden");

  const settingsPatchDenied = await request
    .patch("/api/settings")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .send({ app_name: "Should not be changed by user" });
  assert.equal(settingsPatchDenied.statusCode, 403);
  assert.equal(settingsPatchDenied.body.error, "forbidden");

  const testEmailDenied = await request
    .post("/api/settings/test-email")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .send({ to: userAuth.user.email });
  assert.equal(testEmailDenied.statusCode, 403);
  assert.equal(testEmailDenied.body.error, "forbidden");

  const userRolePatchDenied = await request
    .patch(`/api/users/${userAuth.user.id}`)
    .set("Authorization", `Bearer ${userAuth.token}`)
    .send({ role: "developer" });
  assert.equal(userRolePatchDenied.statusCode, 403);
  assert.equal(userRolePatchDenied.body.error, "forbidden");

  const projectCreatedByDev = await request
    .post("/api/projects")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ name: "RBAC project icon audit", color: "#1266AA" });
  assert.equal(projectCreatedByDev.statusCode, 201);

  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6p9RkAAAAASUVORK5CYII=",
    "base64"
  );

  const projectIconUploadDenied = await request
    .post(`/api/projects/${projectCreatedByDev.body.id}/icon`)
    .set("Authorization", `Bearer ${userAuth.token}`)
    .attach("icon", tinyPng, {
      filename: "icon.png",
      contentType: "image/png"
    });
  assert.equal(projectIconUploadDenied.statusCode, 403);
  assert.equal(projectIconUploadDenied.body.error, "forbidden");

  const projectIconDeleteDenied = await request
    .delete(`/api/projects/${projectCreatedByDev.body.id}/icon`)
    .set("Authorization", `Bearer ${userAuth.token}`);
  assert.equal(projectIconDeleteDenied.statusCode, 403);
  assert.equal(projectIconDeleteDenied.body.error, "forbidden");
});

test("ownership audit: user cannot mutate other reporter ticket", async () => {
  const foreignTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${secondUserAuth.token}`)
    .field(
      makeBugPayload({
        title: "Ownership check for foreign ticket update should be denied"
      })
    );
  assert.equal(foreignTicket.statusCode, 201);

  const foreignPatchDenied = await request
    .patch(`/api/tickets/${foreignTicket.body.id}`)
    .set("Authorization", `Bearer ${userAuth.token}`)
    .send({ title: "Unauthorized edit attempt by another reporter user" });
  assert.equal(foreignPatchDenied.statusCode, 403);
  assert.equal(foreignPatchDenied.body.error, "forbidden");

  const internalCommentDenied = await request
    .post(`/api/tickets/${foreignTicket.body.id}/comments`)
    .set("Authorization", `Bearer ${secondUserAuth.token}`)
    .send({
      content: "User cannot create internal comment",
      is_internal: true
    });
  assert.equal(internalCommentDenied.statusCode, 403);
  assert.equal(internalCommentDenied.body.error, "forbidden");
});

test("rbac audit: developer can mutate protected resources", async () => {
  const createProject = await request
    .post("/api/projects")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      name: "RBAC audit project",
      description: "Project created by developer in RBAC audit",
      color: "#123ABC"
    });
  assert.equal(createProject.statusCode, 201);
  const projectId = createProject.body.id;

  const patchProject = await request
    .patch(`/api/projects/${projectId}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ name: "RBAC audit project updated" });
  assert.equal(patchProject.statusCode, 200);
  assert.equal(patchProject.body.name, "RBAC audit project updated");

  const patchSettings = await request
    .patch("/api/settings")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ app_name: "OpenArca RBAC Audit" });
  assert.equal(patchSettings.statusCode, 200);
  assert.equal(patchSettings.body.app_name, "OpenArca RBAC Audit");

  const promoteUser = await request
    .patch(`/api/users/${secondUserAuth.user.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ role: "developer" });
  assert.equal(promoteUser.statusCode, 200);
  assert.equal(promoteUser.body.role, "developer");

  const deleteProject = await request
    .delete(`/api/projects/${projectId}`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(deleteProject.statusCode, 204);
});
