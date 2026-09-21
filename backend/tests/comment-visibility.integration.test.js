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

// The whole matrix this file pins: {reporter, developer, machine} viewing a
// comment that is {published, unpublished} x {internal, public}. Two risks
// motivate testing every cell instead of the happy path:
//  - a confident wrong analysis rendered like a human answer gets relayed to
//    a customer as fact (the internal/is_internal axis), and
//  - an unreviewed draft leaking to the reporter defeats the whole approval
//    gate (the published/published_at axis).
// A machine token inherits its owner's role for these checks (see
// services/tickets.js), so a machine owned by a developer is expected to see
// exactly what that developer sees. "Reach" for a machine owned by a
// reporter is therefore the same as that reporter's own reach: their own
// tickets only, never another reporter's project.

let envRoot;
let app;
let db;
let request;
let devAuth;
let reporterAuth;
let otherReporterAuth;
let ticketId;
let otherProjectTicketId;
let devMachineToken;
let reporterMachineToken;

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
  const devEmail = uniqueEmail("dev-visibility");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );

  devAuth = await loginByOtp({ request, db, email: devEmail });
  reporterAuth = await loginByOtp({ request, db, email: uniqueEmail("reporter-visibility") });
  otherReporterAuth = await loginByOtp({
    request,
    db,
    email: uniqueEmail("other-reporter-visibility")
  });

  const createTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${reporterAuth.token}`)
    .field(makeBugPayload({ title: "Visibility matrix ticket" }));
  assert.equal(createTicket.statusCode, 201);
  ticketId = createTicket.body.id;

  // A ticket reported by someone else, standing in for "a project outside
  // its reach": nothing about this ticket has anything to do with
  // reporterAuth or their machine.
  const createOtherTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${otherReporterAuth.token}`)
    .field(makeBugPayload({ title: "Ticket outside reach" }));
  assert.equal(createOtherTicket.statusCode, 201);
  otherProjectTicketId = createOtherTicket.body.id;

  const devAccount = accounts.create({
    name: "dev agent",
    ownerUserId: devAuth.user.id,
    description: "owned by a developer"
  });
  devMachineToken = accounts.mintToken({
    accountId: devAccount.id,
    // Pelny zestaw: ten plik bada widocznosc i autorstwo, a nie zakresy.
    // Egzekwowanie zakresow ma wlasne testy w machine-identity.integration.test.js.
    scopes: ["tickets:read", "tickets:comment", "tickets:propose_reply"]
  }).clearToken;

  const reporterAccount = accounts.create({
    name: "reporter agent",
    ownerUserId: reporterAuth.user.id,
    description: "owned by a reporter"
  });
  reporterMachineToken = accounts.mintToken({
    accountId: reporterAccount.id,
    // Pelny zestaw: ten plik bada widocznosc i autorstwo, a nie zakresy.
    // Egzekwowanie zakresow ma wlasne testy w machine-identity.integration.test.js.
    scopes: ["tickets:read", "tickets:comment", "tickets:propose_reply"]
  }).clearToken;
});

test.after(() => cleanupTestEnv(envRoot));

function fetchTicketAs(token, id = ticketId) {
  return request.get(`/api/tickets/${id}`).set("Authorization", `Bearer ${token}`);
}

// Seeds a comment directly so its published/internal state is exact,
// independent of which creation paths are separately tested below.
let seedCounter = 0;
function seedComment({ isInternal, published }) {
  seedCounter += 1;
  const id = `matrix-comment-${seedCounter}-${isInternal ? "int" : "pub"}-${
    published ? "released" : "draft"
  }`;
  db.prepare(
    `INSERT INTO comments (
      id, ticket_id, user_id, content, is_developer, is_internal,
      is_closure_summary, author_kind, type, created_at, published_at
    ) VALUES (?, ?, ?, ?, 1, ?, 0, 'human', 'comment', datetime('now'), ${
      published ? "datetime('now')" : "NULL"
    })`
  ).run(
    id,
    ticketId,
    devAuth.user.id,
    `Seeded comment: internal=${isInternal} published=${published}`,
    isInternal ? 1 : 0
  );
  return id;
}

let seededIds = {};

test("seed one comment for each of the four published x internal cells", () => {
  seededIds.publishedPublic = seedComment({ isInternal: false, published: true });
  seededIds.publishedInternal = seedComment({ isInternal: true, published: true });
  seededIds.unpublishedPublic = seedComment({ isInternal: false, published: false });
  seededIds.unpublishedInternal = seedComment({ isInternal: true, published: false });

  for (const id of Object.values(seededIds)) {
    const row = db.prepare("SELECT id FROM comments WHERE id = ?").get(id);
    assert.ok(row, `expected seeded comment ${id} to exist`);
  }
});

// ---------------------------------------------------------------------------
// Visibility matrix: {reporter, developer, machine} x {published, unpublished}
// x {internal, public}. Every cell below is one explicit assertion.
// ---------------------------------------------------------------------------

test("reporter: published + public is visible", async () => {
  const res = await fetchTicketAs(reporterAuth.token);
  assert.equal(res.statusCode, 200);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(ids.includes(seededIds.publishedPublic));
});

test("reporter: published + internal is NOT visible", async () => {
  const res = await fetchTicketAs(reporterAuth.token);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(!ids.includes(seededIds.publishedInternal));
});

test("reporter: unpublished + public is NOT visible", async () => {
  const res = await fetchTicketAs(reporterAuth.token);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(!ids.includes(seededIds.unpublishedPublic));
});

test("reporter: unpublished + internal is NOT visible", async () => {
  const res = await fetchTicketAs(reporterAuth.token);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(!ids.includes(seededIds.unpublishedInternal));
});

// Blanket check restating the acceptance criterion directly: whatever cells
// exist, none of what the reporter receives is ever a draft or internal.
test("reporter: never receives an unpublished or internal comment, in any combination", async () => {
  const res = await fetchTicketAs(reporterAuth.token);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.comments.length > 0, "sanity: reporter should still see the public ones");
  for (const comment of res.body.comments) {
    assert.equal(comment.is_internal, 0, `comment ${comment.id} is internal but reached the reporter`);
    assert.notEqual(
      comment.published_at,
      null,
      `comment ${comment.id} is unpublished but reached the reporter`
    );
  }
});

test("developer: published + public is visible", async () => {
  const res = await fetchTicketAs(devAuth.token);
  assert.equal(res.statusCode, 200);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(ids.includes(seededIds.publishedPublic));
});

test("developer: published + internal is visible", async () => {
  const res = await fetchTicketAs(devAuth.token);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(ids.includes(seededIds.publishedInternal));
});

test("developer: unpublished + public is visible", async () => {
  const res = await fetchTicketAs(devAuth.token);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(ids.includes(seededIds.unpublishedPublic));
});

test("developer: unpublished + internal is visible", async () => {
  const res = await fetchTicketAs(devAuth.token);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(ids.includes(seededIds.unpublishedInternal));
});

// A machine owned by a developer inherits the owner's role for these reads
// (req.user is shaped from the owner), so it is expected to see exactly what
// the developer sees — nothing more is granted, but nothing less either.
test("machine (owned by developer): published + public is visible", async () => {
  const res = await fetchTicketAs(devMachineToken);
  assert.equal(res.statusCode, 200);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(ids.includes(seededIds.publishedPublic));
});

test("machine (owned by developer): published + internal is visible", async () => {
  const res = await fetchTicketAs(devMachineToken);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(ids.includes(seededIds.publishedInternal));
});

test("machine (owned by developer): unpublished + public is visible", async () => {
  const res = await fetchTicketAs(devMachineToken);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(ids.includes(seededIds.unpublishedPublic));
});

test("machine (owned by developer): unpublished + internal is visible", async () => {
  const res = await fetchTicketAs(devMachineToken);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(ids.includes(seededIds.unpublishedInternal));
});

// A machine owned by a plain reporter has exactly the reporter's reach: it
// must never see a draft or an internal comment either, on the reporter's
// own ticket.
test("machine (owned by reporter): published + public is visible", async () => {
  const res = await fetchTicketAs(reporterMachineToken);
  assert.equal(res.statusCode, 200);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(ids.includes(seededIds.publishedPublic));
});

test("machine (owned by reporter): published + internal is NOT visible", async () => {
  const res = await fetchTicketAs(reporterMachineToken);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(!ids.includes(seededIds.publishedInternal));
});

test("machine (owned by reporter): unpublished + public is NOT visible", async () => {
  const res = await fetchTicketAs(reporterMachineToken);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(!ids.includes(seededIds.unpublishedPublic));
});

test("machine (owned by reporter): unpublished + internal is NOT visible", async () => {
  const res = await fetchTicketAs(reporterMachineToken);
  const ids = res.body.comments.map((c) => c.id);
  assert.ok(!ids.includes(seededIds.unpublishedInternal));
});

// ---------------------------------------------------------------------------
// Creation-side matrix: who is allowed to create a comment in each
// published x internal state. A reporter must not be able to create
// anything they could not later read back.
// ---------------------------------------------------------------------------

function createCommentAs(token, { isInternal, publish }) {
  return request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      content: `Created comment: internal=${isInternal} publish=${publish}`,
      is_internal: isInternal,
      publish
    });
}

test("reporter can create published + public", async () => {
  const res = await createCommentAs(reporterAuth.token, { isInternal: false, publish: true });
  assert.equal(res.statusCode, 201);
});

test("reporter cannot create published + internal", async () => {
  const res = await createCommentAs(reporterAuth.token, { isInternal: true, publish: true });
  assert.equal(res.statusCode, 403);
});

test("reporter cannot create unpublished + public", async () => {
  const res = await createCommentAs(reporterAuth.token, { isInternal: false, publish: false });
  assert.equal(res.statusCode, 403);
});

test("reporter cannot create unpublished + internal", async () => {
  const res = await createCommentAs(reporterAuth.token, { isInternal: true, publish: false });
  assert.equal(res.statusCode, 403);
});

test("developer can create all four published x internal combinations", async () => {
  for (const isInternal of [false, true]) {
    for (const publish of [false, true]) {
      const res = await createCommentAs(devAuth.token, { isInternal, publish });
      assert.equal(
        res.statusCode,
        201,
        `developer create(internal=${isInternal}, publish=${publish}) should succeed`
      );
    }
  }
});

test("machine (owned by developer) can create all four published x internal combinations", async () => {
  for (const isInternal of [false, true]) {
    for (const publish of [false, true]) {
      const res = await createCommentAs(devMachineToken, { isInternal, publish });
      assert.equal(
        res.statusCode,
        201,
        `dev-machine create(internal=${isInternal}, publish=${publish}) should succeed`
      );
      assert.equal(res.body.author_kind, "machine");
    }
  }
});

test("machine (owned by reporter) cannot create internal or unpublished comments", async () => {
  const publicPublished = await createCommentAs(reporterMachineToken, {
    isInternal: false,
    publish: true
  });
  assert.equal(publicPublished.statusCode, 201);

  const internal = await createCommentAs(reporterMachineToken, {
    isInternal: true,
    publish: true
  });
  assert.equal(internal.statusCode, 403);

  const unpublished = await createCommentAs(reporterMachineToken, {
    isInternal: false,
    publish: false
  });
  assert.equal(unpublished.statusCode, 403);
});

// ---------------------------------------------------------------------------
// Reach: a machine token must not be able to read tickets belonging to a
// project/reporter outside it. "Outside its reach" here is exactly the same
// boundary the human it is bound to has: a machine owned by a plain reporter
// has that reporter's reach, nothing wider.
// ---------------------------------------------------------------------------

test("a machine token cannot read a ticket outside its owner's reach", async () => {
  const res = await fetchTicketAs(reporterMachineToken, otherProjectTicketId);
  assert.equal(res.statusCode, 403);
});

test("that same ticket does not appear in the machine's ticket list either", async () => {
  const res = await request
    .get("/api/tickets")
    .set("Authorization", `Bearer ${reporterMachineToken}`);
  assert.equal(res.statusCode, 200);
  const ids = res.body.map((t) => t.id);
  assert.ok(!ids.includes(otherProjectTicketId));
});

test("the ticket owner themself is refused the same way a human reporter would be", async () => {
  const res = await fetchTicketAs(reporterAuth.token, otherProjectTicketId);
  assert.equal(res.statusCode, 403);
});

test("a developer-owned machine, by contrast, can read across reporters (developer reach)", async () => {
  const res = await fetchTicketAs(devMachineToken, otherProjectTicketId);
  assert.equal(res.statusCode, 200);
});
