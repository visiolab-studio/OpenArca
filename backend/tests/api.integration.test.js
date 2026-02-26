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

async function addClosureSummary({ ticketId, token, content }) {
  return request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      content: content || "Podsumowanie zamknięcia: wykonano poprawkę i wdrożono zmiany.",
      is_closure_summary: true
    });
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

test("developer can create, list and remove related ticket links", async () => {
  const ticketA = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(makeBugPayload({ title: "Related link source ticket" }));
  assert.equal(ticketA.statusCode, 201);

  const ticketB = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(makeBugPayload({ title: "Related link target ticket" }));
  assert.equal(ticketB.statusCode, 201);

  const createRelation = await request
    .post(`/api/tickets/${ticketA.body.id}/related`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ related_ticket_id: ticketB.body.id });
  assert.equal(createRelation.statusCode, 201);
  assert.equal(createRelation.body.length, 1);
  assert.equal(createRelation.body[0].id, ticketB.body.id);

  const createDuplicate = await request
    .post(`/api/tickets/${ticketA.body.id}/related`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ related_ticket_number: ticketB.body.number });
  assert.equal(createDuplicate.statusCode, 200);
  assert.equal(createDuplicate.body.length, 1);

  const listRelation = await request
    .get(`/api/tickets/${ticketA.body.id}/related`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(listRelation.statusCode, 200);
  assert.equal(listRelation.body.length, 1);
  assert.equal(listRelation.body[0].id, ticketB.body.id);

  const ticketDetail = await request
    .get(`/api/tickets/${ticketA.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(ticketDetail.statusCode, 200);
  assert.ok(Array.isArray(ticketDetail.body.related_tickets));
  assert.equal(ticketDetail.body.related_tickets.length, 1);
  assert.equal(ticketDetail.body.related_tickets[0].id, ticketB.body.id);

  const deleteRelation = await request
    .delete(`/api/tickets/${ticketA.body.id}/related/${ticketB.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(deleteRelation.statusCode, 204);

  const listAfterDelete = await request
    .get(`/api/tickets/${ticketA.body.id}/related`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(listAfterDelete.statusCode, 200);
  assert.equal(listAfterDelete.body.length, 0);
});

test("related ticket links keep RBAC on write and visibility filter on read", async () => {
  const otherUserAuth = await loginByOtp({
    request,
    db,
    email: uniqueEmail("related-other")
  });
  assert.equal(otherUserAuth.user.role, "user");

  const mineA = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(makeBugPayload({ title: "Related visibility source" }));
  assert.equal(mineA.statusCode, 201);

  const mineB = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(makeBugPayload({ title: "Related visibility allowed target" }));
  assert.equal(mineB.statusCode, 201);

  const foreignTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${otherUserAuth.token}`)
    .field(makeBugPayload({ title: "Related visibility hidden target" }));
  assert.equal(foreignTicket.statusCode, 201);

  const userCannotCreate = await request
    .post(`/api/tickets/${mineA.body.id}/related`)
    .set("Authorization", `Bearer ${userAuth.token}`)
    .send({ related_ticket_id: mineB.body.id });
  assert.equal(userCannotCreate.statusCode, 403);

  const devCreatesOwnRelation = await request
    .post(`/api/tickets/${mineA.body.id}/related`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ related_ticket_id: mineB.body.id });
  assert.equal(devCreatesOwnRelation.statusCode, 201);

  const devCreatesForeignRelation = await request
    .post(`/api/tickets/${mineA.body.id}/related`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ related_ticket_id: foreignTicket.body.id });
  assert.equal(devCreatesForeignRelation.statusCode, 201);

  const mineVisible = await request
    .get(`/api/tickets/${mineA.body.id}/related`)
    .set("Authorization", `Bearer ${userAuth.token}`);
  assert.equal(mineVisible.statusCode, 200);
  assert.equal(mineVisible.body.some((ticket) => ticket.id === mineB.body.id), true);
  assert.equal(mineVisible.body.some((ticket) => ticket.id === foreignTicket.body.id), false);

  const userCannotDelete = await request
    .delete(`/api/tickets/${mineA.body.id}/related/${mineB.body.id}`)
    .set("Authorization", `Bearer ${userAuth.token}`);
  assert.equal(userCannotDelete.statusCode, 403);
});

test("developer can create, list and remove external references", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(makeBugPayload({ title: "External references source ticket" }));
  assert.equal(created.statusCode, 201);

  const createRef = await request
    .post(`/api/tickets/${created.body.id}/external-references`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      ref_type: "git_pr",
      url: "https://github.com/visiolab-studio/OpenArca/pull/42",
      title: "PR #42"
    });
  assert.equal(createRef.statusCode, 201);
  assert.equal(createRef.body.length, 1);
  assert.equal(createRef.body[0].ref_type, "git_pr");

  const listRefs = await request
    .get(`/api/tickets/${created.body.id}/external-references`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(listRefs.statusCode, 200);
  assert.equal(listRefs.body.length, 1);
  assert.equal(listRefs.body[0].url.includes("github.com"), true);

  const ticketDetail = await request
    .get(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(ticketDetail.statusCode, 200);
  assert.ok(Array.isArray(ticketDetail.body.external_references));
  assert.equal(ticketDetail.body.external_references.length, 1);

  const deleteRef = await request
    .delete(`/api/tickets/${created.body.id}/external-references/${listRefs.body[0].id}`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(deleteRef.statusCode, 204);

  const afterDelete = await request
    .get(`/api/tickets/${created.body.id}/external-references`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(afterDelete.statusCode, 200);
  assert.equal(afterDelete.body.length, 0);
});

test("external references keep RBAC and ownership constraints", async () => {
  const otherUserAuth = await loginByOtp({
    request,
    db,
    email: uniqueEmail("extref-other")
  });

  const mine = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(makeBugPayload({ title: "External refs ownership source" }));
  assert.equal(mine.statusCode, 201);

  const foreign = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${otherUserAuth.token}`)
    .field(makeBugPayload({ title: "External refs foreign ticket" }));
  assert.equal(foreign.statusCode, 201);

  const userCannotCreate = await request
    .post(`/api/tickets/${mine.body.id}/external-references`)
    .set("Authorization", `Bearer ${userAuth.token}`)
    .send({
      ref_type: "monitoring",
      url: "https://monitoring.example.com/alerts/123"
    });
  assert.equal(userCannotCreate.statusCode, 403);

  const devCreatesMine = await request
    .post(`/api/tickets/${mine.body.id}/external-references`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      ref_type: "deployment",
      url: "https://deploy.example.com/releases/2026-02-23"
    });
  assert.equal(devCreatesMine.statusCode, 201);

  const userCanReadOwn = await request
    .get(`/api/tickets/${mine.body.id}/external-references`)
    .set("Authorization", `Bearer ${userAuth.token}`);
  assert.equal(userCanReadOwn.statusCode, 200);
  assert.equal(userCanReadOwn.body.length, 1);

  const userCannotReadForeign = await request
    .get(`/api/tickets/${foreign.body.id}/external-references`)
    .set("Authorization", `Bearer ${userAuth.token}`);
  assert.equal(userCannotReadForeign.statusCode, 403);

  const invalidProtocol = await request
    .post(`/api/tickets/${mine.body.id}/external-references`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      ref_type: "other",
      url: "ftp://example.com/ref"
    });
  assert.equal(invalidProtocol.statusCode, 400);
  assert.equal(invalidProtocol.body.error, "validation_error");
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

test("project icon upload is available and propagated to ticket payloads", async () => {
  const createdProject = await request
    .post("/api/projects")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      name: "Project icon integration",
      description: "Project for icon propagation verification",
      color: "#159A4A"
    });
  assert.equal(createdProject.statusCode, 201);
  assert.equal(createdProject.body.icon_url, null);

  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6p9RkAAAAASUVORK5CYII=",
    "base64"
  );

  const uploadIcon = await request
    .post(`/api/projects/${createdProject.body.id}/icon`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .attach("icon", tinyPng, {
      filename: "project-icon.png",
      contentType: "image/png"
    });
  assert.equal(uploadIcon.statusCode, 200);
  assert.equal(typeof uploadIcon.body.icon_url, "string");
  assert.equal(uploadIcon.body.icon_url.startsWith(`/api/projects/${createdProject.body.id}/icon`), true);

  const iconAsset = await request.get(uploadIcon.body.icon_url);
  assert.equal(iconAsset.statusCode, 200);
  assert.equal(iconAsset.headers["content-type"]?.startsWith("image/"), true);

  const createTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Ticket with project icon mapping",
        project_id: createdProject.body.id
      })
    );
  assert.equal(createTicket.statusCode, 201);

  const listForUser = await request
    .get("/api/tickets?my=1")
    .set("Authorization", `Bearer ${userAuth.token}`);
  assert.equal(listForUser.statusCode, 200);
  const listed = listForUser.body.find((ticket) => ticket.id === createTicket.body.id);
  assert.equal(Boolean(listed?.project_icon_url), true);

  const detailForDev = await request
    .get(`/api/tickets/${createTicket.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(detailForDev.statusCode, 200);
  assert.equal(Boolean(detailForDev.body.project_icon_url), true);

  const boardForDev = await request
    .get("/api/tickets/board")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(boardForDev.statusCode, 200);
  const boardHit = Object.values(boardForDev.body)
    .flat()
    .find((ticket) => ticket?.id === createTicket.body.id);
  assert.equal(Boolean(boardHit?.project_icon_url), true);

  const deleteIcon = await request
    .delete(`/api/projects/${createdProject.body.id}/icon`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(deleteIcon.statusCode, 204);

  const projectsAfterDelete = await request
    .get("/api/projects")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(projectsAfterDelete.statusCode, 200);
  const deletedIconProject = projectsAfterDelete.body.find((project) => project.id === createdProject.body.id);
  assert.equal(deletedIconProject.icon_url, null);
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

test("telemetry records ticket.created and ticket.closed events", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Telemetry check for ticket lifecycle events"
      })
    );
  assert.equal(created.statusCode, 201);

  const summary = await addClosureSummary({
    ticketId: created.body.id,
    token: devAuth.token,
    content: "Podsumowanie zamknięcia dla telemetry ticket.closed."
  });
  assert.equal(summary.statusCode, 201);

  const closed = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      status: "closed"
    });
  assert.equal(closed.statusCode, 200);
  assert.equal(closed.body.status, "closed");

  const events = db
    .prepare(
      `SELECT event_name, user_id, ticket_id, properties_json
       FROM telemetry_events
       WHERE ticket_id = ?
       ORDER BY created_at ASC`
    )
    .all(created.body.id);

  assert.ok(events.some((event) => event.event_name === "ticket.created"));
  assert.ok(events.some((event) => event.event_name === "ticket.closed"));

  const createdEvent = events.find((event) => event.event_name === "ticket.created");
  assert.equal(createdEvent.user_id, userAuth.user.id);
  assert.equal(createdEvent.ticket_id, created.body.id);
  assert.equal(JSON.parse(createdEvent.properties_json).status, "submitted");

  const closedEvent = events.find((event) => event.event_name === "ticket.closed");
  assert.equal(closedEvent.user_id, devAuth.user.id);
  assert.equal(JSON.parse(closedEvent.properties_json).new_status, "closed");
});

test("telemetry records devtodo.reorder event for developer reorder action", async () => {
  const firstTask = await request
    .post("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      title: "Telemetry reorder task A",
      priority: "normal"
    });
  assert.equal(firstTask.statusCode, 201);

  const secondTask = await request
    .post("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      title: "Telemetry reorder task B",
      priority: "high"
    });
  assert.equal(secondTask.statusCode, 201);

  const reorderResult = await request
    .post("/api/dev-tasks/reorder")
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      order: [
        { id: secondTask.body.id, order_index: 0 },
        { id: firstTask.body.id, order_index: 1 }
      ]
    });
  assert.equal(reorderResult.statusCode, 200);
  assert.equal(Array.isArray(reorderResult.body.active), true);

  const event = db
    .prepare(
      `SELECT event_name, user_id, ticket_id, properties_json
       FROM telemetry_events
       WHERE event_name = 'devtodo.reorder'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get();

  assert.ok(event);
  assert.equal(event.event_name, "devtodo.reorder");
  assert.equal(event.user_id, devAuth.user.id);
  assert.equal(event.ticket_id, null);

  const properties = JSON.parse(event.properties_json);
  assert.equal(properties.items_count, 2);
  assert.ok(Number(properties.active_count_after) >= 2);
});

test("telemetry records board.drag event when developer moves ticket across statuses", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Board drag telemetry event should be persisted"
      })
    );
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.status, "submitted");

  const accept = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });
  assert.equal(accept.statusCode, 200);
  assert.equal(accept.body.status, "verified");

  const dragMove = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "in_progress" });
  assert.equal(dragMove.statusCode, 200);
  assert.equal(dragMove.body.status, "in_progress");

  const event = db
    .prepare(
      `SELECT event_name, user_id, ticket_id, properties_json
       FROM telemetry_events
       WHERE event_name = 'board.drag' AND ticket_id = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(created.body.id);

  assert.ok(event);
  assert.equal(event.event_name, "board.drag");
  assert.equal(event.user_id, devAuth.user.id);
  assert.equal(event.ticket_id, created.body.id);

  const properties = JSON.parse(event.properties_json);
  assert.equal(properties.old_status, "verified");
  assert.equal(properties.new_status, "in_progress");
});

test("telemetry records closure_summary_added when developer adds closure summary comment", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Closure summary telemetry event should be persisted"
      })
    );
  assert.equal(created.statusCode, 201);

  const comment = await request
    .post(`/api/tickets/${created.body.id}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      content: "Podsumowanie zamknięcia: naprawiono błąd i wdrożono poprawkę.",
      is_closure_summary: true
    });
  assert.equal(comment.statusCode, 201);
  assert.equal(comment.body.is_closure_summary, 1);

  const event = db
    .prepare(
      `SELECT event_name, user_id, ticket_id, properties_json
       FROM telemetry_events
       WHERE event_name = 'closure_summary_added' AND ticket_id = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(created.body.id);

  assert.ok(event);
  assert.equal(event.event_name, "closure_summary_added");
  assert.equal(event.user_id, devAuth.user.id);
  assert.equal(event.ticket_id, created.body.id);

  const properties = JSON.parse(event.properties_json);
  assert.equal(typeof properties.comment_id, "string");
  assert.ok(properties.comment_id.length > 10);
});

test("user cannot mark comment as closure summary", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Closure summary flag should be restricted to developer role"
      })
    );
  assert.equal(created.statusCode, 201);

  const forbidden = await request
    .post(`/api/tickets/${created.body.id}/comments`)
    .set("Authorization", `Bearer ${userAuth.token}`)
    .send({
      content: "Próba ustawienia flagi closure summary przez usera.",
      is_closure_summary: true
    });

  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.body.error, "forbidden");
});

test("closing ticket requires closure summary comment", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Closing workflow should require closure summary before closed status"
      })
    );
  assert.equal(created.statusCode, 201);

  const verify = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });
  assert.equal(verify.statusCode, 200);

  const closeWithoutSummary = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "closed" });
  assert.equal(closeWithoutSummary.statusCode, 400);
  assert.equal(closeWithoutSummary.body.error, "closure_summary_required");

  const summary = await addClosureSummary({
    ticketId: created.body.id,
    token: devAuth.token,
    content: "Closure summary wymagane przed zamknięciem: naprawiono i wdrożono."
  });
  assert.equal(summary.statusCode, 201);

  const closeWithSummary = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "closed" });
  assert.equal(closeWithSummary.statusCode, 200);
  assert.equal(closeWithSummary.body.status, "closed");
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

test("waiting status finalization moves linked dev task to done and supports reopen", async () => {
  const created = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${userAuth.token}`)
    .field(
      makeBugPayload({
        title: "Waiting finalization should complete developer task"
      })
    );
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.status, "submitted");

  const accepted = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.assignee_id, devAuth.user.id);

  const started = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "in_progress" });
  assert.equal(started.statusCode, 200);
  assert.equal(started.body.status, "in_progress");

  const movedToWaiting = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "waiting" });
  assert.equal(movedToWaiting.statusCode, 200);
  assert.equal(movedToWaiting.body.status, "waiting");

  const tasksAfterWaiting = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(tasksAfterWaiting.statusCode, 200);

  const activeAfterWaiting = tasksAfterWaiting.body.active.filter((task) => task.ticket_id === created.body.id);
  const doneAfterWaiting = tasksAfterWaiting.body.done.filter((task) => task.ticket_id === created.body.id);
  assert.equal(activeAfterWaiting.length, 0);
  assert.equal(doneAfterWaiting.length, 1);
  assert.equal(doneAfterWaiting[0].status, "done");

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

  const activeAfterReopen = tasksAfterReopen.body.active.filter((task) => task.ticket_id === created.body.id);
  const doneAfterReopen = tasksAfterReopen.body.done.filter((task) => task.ticket_id === created.body.id);
  assert.equal(activeAfterReopen.length, 1);
  assert.equal(activeAfterReopen[0].status, "todo");
  assert.equal(doneAfterReopen.length, 0);
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

test("reassigning or unassigning accepted ticket keeps a single active linked dev task in sync", async () => {
  const secondDevEmail = uniqueEmail("dev-reassign");
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
        title: "Reassign should not leave stale active linked tasks"
      })
    );
  assert.equal(created.statusCode, 201);

  const accepted = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.assignee_id, devAuth.user.id);

  const firstDevTasks = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(firstDevTasks.statusCode, 200);
  assert.equal(firstDevTasks.body.active.filter((task) => task.ticket_id === created.body.id).length, 1);

  const reassigned = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${secondDevAuth.token}`)
    .send({ assignee_id: secondDevAuth.user.id, status: "verified" });
  assert.equal(reassigned.statusCode, 200);
  assert.equal(reassigned.body.assignee_id, secondDevAuth.user.id);

  const firstDevAfterReassign = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(firstDevAfterReassign.statusCode, 200);
  assert.equal(firstDevAfterReassign.body.active.filter((task) => task.ticket_id === created.body.id).length, 0);

  const secondDevAfterReassign = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${secondDevAuth.token}`);
  assert.equal(secondDevAfterReassign.statusCode, 200);
  const secondDevLinked = secondDevAfterReassign.body.active.filter((task) => task.ticket_id === created.body.id);
  assert.equal(secondDevLinked.length, 1);
  assert.equal(secondDevLinked[0].created_by, secondDevAuth.user.id);

  const unassigned = await request
    .patch(`/api/tickets/${created.body.id}`)
    .set("Authorization", `Bearer ${secondDevAuth.token}`)
    .send({ assignee_id: null, status: "verified" });
  assert.equal(unassigned.statusCode, 200);
  assert.equal(unassigned.body.assignee_id, null);

  const secondDevAfterUnassign = await request
    .get("/api/dev-tasks")
    .set("Authorization", `Bearer ${secondDevAuth.token}`);
  assert.equal(secondDevAfterUnassign.statusCode, 200);
  assert.equal(secondDevAfterUnassign.body.active.filter((task) => task.ticket_id === created.body.id).length, 0);

  const activeLinkedCount = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM dev_tasks
       WHERE ticket_id = ?
         AND status IN ('todo', 'in_progress')`
    )
    .get(created.body.id).count;
  assert.equal(activeLinkedCount, 0);
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

  const summary = await addClosureSummary({
    ticketId: created.body.id,
    token: devAuth.token,
    content: "Podsumowanie dla scenariusza reopen w kanban."
  });
  assert.equal(summary.statusCode, 201);

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
