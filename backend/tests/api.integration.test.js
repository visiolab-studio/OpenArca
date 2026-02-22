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

test("user can upload avatar and profile exposes avatar metadata", async () => {
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6p9RkAAAAASUVORK5CYII=",
    "base64"
  );

  const uploadAvatar = await request
    .post("/api/auth/me/avatar")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .attach("avatar", tinyPng, {
      filename: "profile.png",
      contentType: "image/png"
    });

  assert.equal(uploadAvatar.statusCode, 200);
  assert.ok(typeof uploadAvatar.body.avatar_filename === "string");
  assert.ok(uploadAvatar.body.avatar_filename.length > 10);
  assert.ok(typeof uploadAvatar.body.avatar_updated_at === "string");

  const me = await request
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${userAuth.token}`);
  assert.equal(me.statusCode, 200);
  assert.equal(me.body.avatar_filename, uploadAvatar.body.avatar_filename);

  const avatarAsset = await request.get(`/api/auth/avatar/${uploadAvatar.body.avatar_filename}`);
  assert.equal(avatarAsset.statusCode, 200);
  assert.equal(avatarAsset.headers["content-type"]?.startsWith("image/"), true);
});

test("settings logo upload updates public branding endpoint", async () => {
  const beforeUpload = await request.get("/api/settings/public");
  assert.equal(beforeUpload.statusCode, 200);
  assert.equal(beforeUpload.body.app_logo_url, null);

  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6p9RkAAAAASUVORK5CYII=",
    "base64"
  );

  const uploadResult = await request
    .post("/api/settings/logo")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .attach("logo", tinyPng, {
      filename: "brand-logo.png",
      contentType: "image/png"
    });
  assert.equal(uploadResult.statusCode, 200);
  assert.ok(typeof uploadResult.body.app_logo_url === "string");
  assert.equal(uploadResult.body.app_logo_url.startsWith("/api/settings/logo"), true);

  const afterUpload = await request.get("/api/settings/public");
  assert.equal(afterUpload.statusCode, 200);
  assert.equal(typeof afterUpload.body.app_logo_url, "string");
  assert.equal(afterUpload.body.app_logo_url.startsWith("/api/settings/logo"), true);

  const logoAsset = await request.get(afterUpload.body.app_logo_url);
  assert.equal(logoAsset.statusCode, 200);
  assert.equal(logoAsset.headers["content-type"]?.startsWith("image/"), true);
});

test("settings support SES provider selection and mask secrets", async () => {
  const patchSettings = await request
    .patch("/api/settings")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      mail_provider: "ses",
      ses_access_key_id: "AKIA_TEST_ACCESS_KEY",
      ses_secret_access_key: "test-secret",
      ses_session_token: "test-session-token"
    });

  assert.equal(patchSettings.statusCode, 200);
  assert.equal(patchSettings.body.mail_provider, "ses");
  assert.equal(patchSettings.body.ses_access_key_id, "********");
  assert.equal(patchSettings.body.ses_secret_access_key, "********");
  assert.equal(patchSettings.body.ses_session_token, "********");

  const testEmailResult = await request
    .post("/api/settings/test-email")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ to: devAuth.user.email });

  assert.equal(testEmailResult.statusCode, 200);
  assert.equal(testEmailResult.body.success, true);
  assert.equal(testEmailResult.body.mode, "dev-fallback");
});

test("developer todo scope is isolated per user and linked ticket access is restricted", async () => {
  const secondDevEmail = uniqueEmail("dev2");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devAuth.user.email, secondDevEmail])
  );

  const secondDevAuth = await loginByOtp({
    request,
    db,
    email: secondDevEmail
  });
  assert.equal(secondDevAuth.user.role, "developer");

  const ownTask = await request
    .post("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      title: "Własne zadanie developera nr 1",
      priority: "high"
    });
  assert.equal(ownTask.statusCode, 201);

  const secondDevTasks = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${secondDevAuth.token}`);
  assert.equal(secondDevTasks.statusCode, 200);
  assert.equal(secondDevTasks.body.active.some((task) => task.id === ownTask.body.id), false);

  const forbiddenPatch = await request
    .patch(`/api/dev-tasks/${ownTask.body.id}`)
    .set("Authorization", `Bearer ${secondDevAuth.token}`)
    .send({ title: "Nie powinno się udać" });
  assert.equal(forbiddenPatch.statusCode, 404);
  assert.equal(forbiddenPatch.body.error, "task_not_found");

  const assignedElsewhereTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Zgłoszenie przypisane do innego developera"
      })
    );
  assert.equal(assignedElsewhereTicket.statusCode, 201);

  const assignToSecondDev = await request
    .patch(`/api/tickets/${assignedElsewhereTicket.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ assignee_id: secondDevAuth.user.id });
  assert.equal(assignToSecondDev.statusCode, 200);

  const invalidLinkedTask = await request
    .post("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      title: "Próba podpięcia cudzych zgłoszeń",
      ticket_id: assignedElsewhereTicket.body.id
    });
  assert.equal(invalidLinkedTask.statusCode, 400);
  assert.equal(invalidLinkedTask.body.error, "ticket_not_available");

  const unassignedTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Zgłoszenie nieprzypisane do nikogo"
      })
    );
  assert.equal(unassignedTicket.statusCode, 201);

  const validLinkedTask = await request
    .post("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      title: "Podpięcie do nieprzypisanego zgłoszenia",
      ticket_id: unassignedTicket.body.id
    });
  assert.equal(validLinkedTask.statusCode, 201);
  assert.equal(validLinkedTask.body.ticket_id, unassignedTicket.body.id);
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

test("accepting submitted ticket auto-assigns developer and creates linked dev task", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Akceptacja powinna automatycznie utworzyć zadanie TODO"
      })
    );
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.status, "submitted");

  const accepted = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.status, "verified");
  assert.equal(accepted.body.assignee_id, devAuth.user.id);

  const devTasksAfterAccept = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(devTasksAfterAccept.statusCode, 200);

  const linkedTask = devTasksAfterAccept.body.active.find((task) => task.ticket_id === created.body.id);
  assert.ok(linkedTask);
  assert.equal(linkedTask.created_by, devAuth.user.id);
  assert.equal(linkedTask.status, "todo");

  const setInProgress = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "in_progress" });
  assert.equal(setInProgress.statusCode, 200);

  const devTasksAfterStart = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(devTasksAfterStart.statusCode, 200);

  const linkedTasks = devTasksAfterStart.body.active.filter((task) => task.ticket_id === created.body.id);
  assert.equal(linkedTasks.length, 1);
  assert.equal(linkedTasks[0].status, "in_progress");
});

test("planning submitted ticket auto-verifies and keeps explicit assignee", async () => {
  const secondDevEmail = uniqueEmail("dev-planning");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devAuth.user.email, secondDevEmail])
  );

  const secondDevAuth = await loginByOtp({
    request,
    db,
    email: secondDevEmail
  });
  assert.equal(secondDevAuth.user.role, "developer");

  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Planowanie zgłoszenia powinno auto-przenieść do zweryfikowanych"
      })
    );
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.status, "submitted");

  const planned = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      status: "submitted",
      assignee_id: secondDevAuth.user.id,
      planned_date: "2026-04-15",
      estimated_hours: 6
    });
  assert.equal(planned.statusCode, 200);
  assert.equal(planned.body.status, "verified");
  assert.equal(planned.body.assignee_id, secondDevAuth.user.id);
  assert.equal(planned.body.planned_date, "2026-04-15");
  assert.equal(planned.body.estimated_hours, 6);

  const secondDevTasks = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${secondDevAuth.token}`);
  assert.equal(secondDevTasks.statusCode, 200);

  const linkedTask = secondDevTasks.body.active.find((task) => task.ticket_id === created.body.id);
  assert.ok(linkedTask);
  assert.equal(linkedTask.created_by, secondDevAuth.user.id);
  assert.equal(linkedTask.status, "todo");
});

test("reopening ticket from kanban reactivates linked dev task", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Kanban reopen should reactivate linked TODO item"
      })
    );
  assert.equal(created.statusCode, 201);

  const accepted = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.assignee_id, devAuth.user.id);

  const tasksAfterAccept = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(tasksAfterAccept.statusCode, 200);

  const linkedTask = tasksAfterAccept.body.active.find((task) => task.ticket_id === created.body.id);
  assert.ok(linkedTask);
  assert.equal(linkedTask.status, "todo");

  const closeTicket = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "closed" });
  assert.equal(closeTicket.statusCode, 200);
  assert.equal(closeTicket.body.status, "closed");

  const tasksAfterClose = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(tasksAfterClose.statusCode, 200);
  const closedTask = tasksAfterClose.body.done.find((task) => task.id === linkedTask.id);
  assert.ok(closedTask);
  assert.equal(closedTask.status, "done");

  const reopenToVerified = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });
  assert.equal(reopenToVerified.statusCode, 200);
  assert.equal(reopenToVerified.body.status, "verified");

  const tasksAfterReopen = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(tasksAfterReopen.statusCode, 200);

  const reopenedTask = tasksAfterReopen.body.active.find((task) => task.id === linkedTask.id);
  assert.ok(reopenedTask);
  assert.equal(reopenedTask.status, "todo");
  assert.equal(tasksAfterReopen.body.done.some((task) => task.id === linkedTask.id), false);
});

test("claiming unassigned verified ticket creates linked dev task for claiming developer", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Ticket do przejęcia z kolejki bez przypisania"
      })
    );
  assert.equal(created.statusCode, 201);

  const acceptByDev = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });
  assert.equal(acceptByDev.statusCode, 200);
  assert.equal(acceptByDev.body.assignee_id, devAuth.user.id);

  const devTasksAfterAccept = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(devTasksAfterAccept.statusCode, 200);

  const linkedAfterAccept = devTasksAfterAccept.body.active.find((task) => task.ticket_id === created.body.id);
  assert.ok(linkedAfterAccept);

  const deleteLinkedTask = await request
    .delete(`/api/dev-tasks/${linkedAfterAccept.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(deleteLinkedTask.statusCode, 204);

  const unassign = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ assignee_id: null });
  assert.equal(unassign.statusCode, 200);
  assert.equal(unassign.body.assignee_id, null);
  assert.equal(unassign.body.status, "verified");

  const claimByDev1 = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ assignee_id: devAuth.user.id });
  assert.equal(claimByDev1.statusCode, 200);
  assert.equal(claimByDev1.body.assignee_id, devAuth.user.id);

  const devTasksAfterClaim = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(devTasksAfterClaim.statusCode, 200);

  const linkedTask = devTasksAfterClaim.body.active.find((task) => task.ticket_id === created.body.id);
  assert.ok(linkedTask);
  assert.equal(linkedTask.created_by, devAuth.user.id);
});

test("workload endpoint returns global queues with assignee and access flags", async () => {
  const strangerAuth = await loginByOtp({
    request,
    db,
    email: uniqueEmail("other")
  });

  const inProgressTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Błąd synchronizacji API dla panelu handlowego"
      })
    );
  assert.equal(inProgressTicket.statusCode, 201);

  const queueTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${strangerAuth.token}`)
    .field(
      makeBugPayload({
        title: "Problem z kolejką wysyłki powiadomień SMS"
      })
    );
  assert.equal(queueTicket.statusCode, 201);

  const blockedTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Integracja z dostawcą płatności wymaga doprecyzowania"
      })
    );
  assert.equal(blockedTicket.statusCode, 201);

  const submittedTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${strangerAuth.token}`)
    .field(
      makeBugPayload({
        title: "Nowe zgłoszenie czekające na weryfikację działu IT"
      })
    );
  assert.equal(submittedTicket.statusCode, 201);

  const patchInProgress = await request
    .patch(`/api/tickets/${inProgressTicket.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      status: "in_progress",
      assignee_id: devAuth.user.id,
      planned_date: "2026-03-05"
    });
  assert.equal(patchInProgress.statusCode, 200);

  const patchQueue = await request
    .patch(`/api/tickets/${queueTicket.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      status: "verified",
      planned_date: "2026-03-11"
    });
  assert.equal(patchQueue.statusCode, 200);

  const patchBlocked = await request
    .patch(`/api/tickets/${blockedTicket.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      status: "blocked"
    });
  assert.equal(patchBlocked.statusCode, 200);

  const asUser = await request
    .get("/api/tickets/workload")
    .set("Authorization", `Bearer ${userAuth.token}`);
  assert.equal(asUser.statusCode, 200);

  const userInProgress = asUser.body.in_progress.find((row) => row.id === inProgressTicket.body.id);
  assert.ok(userInProgress);
  assert.equal(userInProgress.assignee_id, devAuth.user.id);
  assert.equal(userInProgress.can_open, true);

  const userQueue = asUser.body.queue.find((row) => row.id === queueTicket.body.id);
  assert.ok(userQueue);
  assert.equal(userQueue.status, "verified");
  assert.equal(userQueue.can_open, false);

  const userBlocked = asUser.body.blocked.find((row) => row.id === blockedTicket.body.id);
  assert.ok(userBlocked);
  assert.equal(userBlocked.can_open, true);

  const userSubmitted = asUser.body.submitted.find((row) => row.id === submittedTicket.body.id);
  assert.ok(userSubmitted);
  assert.equal(userSubmitted.status, "submitted");
  assert.equal(userSubmitted.can_open, false);

  assert.ok(asUser.body._stats.open >= 4);
  assert.ok(asUser.body._stats.queue >= 1);

  const asDeveloper = await request
    .get("/api/tickets/workload")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(asDeveloper.statusCode, 200);

  const developerQueue = asDeveloper.body.queue.find((row) => row.id === queueTicket.body.id);
  assert.ok(developerQueue);
  assert.equal(developerQueue.can_open, true);
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
