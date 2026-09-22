const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const Database = require("better-sqlite3");
const supertest = require("supertest");
const {
  cleanupTestEnv,
  initTestEnv,
  loginByOtp,
  makeBugPayload,
  uniqueEmail
} = require("./helpers");

// A comment with published_at IS NULL is a draft: developers only, never the
// reporter, whatever is_internal says. The dangerous half of that rule is the
// migration — every comment written before the column existed must read as
// published, or upgrading silently erases the whole conversation history from
// every reporter's view.
const LEGACY_COMMENT_ID = "11111111-1111-4111-8111-111111111111";
const LEGACY_CREATED_AT = "2024-01-02 03:04:05";

let envRoot;
let app;
let db;
let request;
let devAuth;
let reporterAuth;
let ticketId;

// Writes a pre-migration comments table (no published_at) with one row in it,
// so that requiring ../db afterwards runs the real migration over real legacy
// data instead of a re-creation of it.
function seedLegacyDatabase(dataDir) {
  const legacy = new Database(path.join(dataDir, "test.sqlite"));
  legacy
    .prepare(
      `CREATE TABLE comments (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        user_id TEXT,
        content TEXT NOT NULL,
        is_developer INTEGER NOT NULL DEFAULT 0,
        is_internal INTEGER NOT NULL DEFAULT 0,
        is_closure_summary INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL DEFAULT 'comment',
        parent_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();
  legacy
    .prepare(
      `INSERT INTO comments (id, ticket_id, user_id, content, is_developer, is_internal, created_at)
       VALUES (?, ?, ?, ?, 1, 0, ?)`
    )
    .run(
      LEGACY_COMMENT_ID,
      "00000000-0000-4000-8000-000000000001",
      null,
      "Answer written long before drafts existed.",
      LEGACY_CREATED_AT
    );
  legacy.close();
}

test.before(async () => {
  const env = initTestEnv();
  envRoot = env.root;

  seedLegacyDatabase(env.dataDir);

  app = require("../app");
  db = require("../db");
  request = supertest(app);

  db.prepare("UPDATE settings SET value = ? WHERE key = 'allowed_domains'").run(
    JSON.stringify(["example.com"])
  );
  const devEmail = uniqueEmail("dev-publication");
  db.prepare("UPDATE settings SET value = ? WHERE key = 'developer_emails'").run(
    JSON.stringify([devEmail])
  );

  devAuth = await loginByOtp({ request, db, email: devEmail });
  reporterAuth = await loginByOtp({
    request,
    db,
    email: uniqueEmail("reporter-publication")
  });

  const createTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${reporterAuth.token}`)
    .field(makeBugPayload({ title: "Draft visibility ticket" }));
  assert.equal(createTicket.statusCode, 201);
  ticketId = createTicket.body.id;

  // Re-home the legacy comment onto a real ticket so the reporter read path can
  // be exercised against a row that genuinely predates the column.
  db.prepare("UPDATE comments SET ticket_id = ?, user_id = ? WHERE id = ?").run(
    ticketId,
    devAuth.user.id,
    LEGACY_COMMENT_ID
  );
});

test.after(() => {
  cleanupTestEnv(envRoot);
});

async function createDraft(content) {
  const res = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ content, publish: false });
  assert.equal(res.statusCode, 201);
  return res.body;
}

function fetchTicketAs(token) {
  return request.get(`/api/tickets/${ticketId}`).set("Authorization", `Bearer ${token}`);
}

test("migration backfills published_at = created_at on every pre-existing comment", () => {
  const row = db
    .prepare("SELECT created_at, published_at FROM comments WHERE id = ?")
    .get(LEGACY_COMMENT_ID);

  assert.equal(row.created_at, LEGACY_CREATED_AT);
  assert.equal(row.published_at, LEGACY_CREATED_AT);

  const unpublishedLegacy = db
    .prepare("SELECT COUNT(*) AS n FROM comments WHERE published_at IS NULL")
    .get();
  assert.equal(unpublishedLegacy.n, 0);
});

test("a reporter still sees comment history that predates the column", async () => {
  const res = await fetchTicketAs(reporterAuth.token);
  assert.equal(res.statusCode, 200);
  const ids = res.body.comments.map((comment) => comment.id);
  assert.ok(ids.includes(LEGACY_COMMENT_ID));
});

test("a draft is hidden from the reporter and shown to the developer as unpublished", async () => {
  const draft = await createDraft("Unreviewed analysis, not for the customer yet.");
  assert.equal(draft.published_at, null);
  assert.equal(draft.is_unpublished, true);

  // Proves published_at alone does the hiding: this row is NOT internal.
  const stored = db.prepare("SELECT is_internal FROM comments WHERE id = ?").get(draft.id);
  assert.equal(stored.is_internal, 0);

  const reporterView = await fetchTicketAs(reporterAuth.token);
  assert.equal(reporterView.statusCode, 200);
  assert.ok(!reporterView.body.comments.some((comment) => comment.id === draft.id));
  assert.ok(reporterView.body.comments.every((comment) => comment.published_at != null));

  const devView = await fetchTicketAs(devAuth.token);
  const devComment = devView.body.comments.find((comment) => comment.id === draft.id);
  assert.ok(devComment);
  assert.equal(devComment.is_unpublished, true);
});

test("publishing makes the draft visible to the reporter", async () => {
  const draft = await createDraft("A careful answer, released after review.");

  const publish = await request
    .post(`/api/tickets/${ticketId}/comments/${draft.id}/publish`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({});
  assert.equal(publish.statusCode, 200);
  assert.notEqual(publish.body.published_at, null);
  assert.equal(publish.body.is_unpublished, false);

  const reporterView = await fetchTicketAs(reporterAuth.token);
  const seen = reporterView.body.comments.find((comment) => comment.id === draft.id);
  assert.ok(seen);
  assert.equal(seen.is_unpublished, false);

  const republish = await request
    .post(`/api/tickets/${ticketId}/comments/${draft.id}/publish`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({});
  assert.equal(republish.statusCode, 400);
  assert.equal(republish.body.error, "comment_already_published");
});

test("discarding removes the draft", async () => {
  const draft = await createDraft("Wrong analysis, throw it away.");

  const discard = await request
    .delete(`/api/tickets/${ticketId}/comments/${draft.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(discard.statusCode, 200);

  const row = db.prepare("SELECT id FROM comments WHERE id = ?").get(draft.id);
  assert.equal(row, undefined);

  const devView = await fetchTicketAs(devAuth.token);
  assert.ok(!devView.body.comments.some((comment) => comment.id === draft.id));
});

test("a published comment cannot be discarded", async () => {
  const published = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ content: "Already said out loud to the reporter." });
  assert.equal(published.statusCode, 201);
  assert.notEqual(published.body.published_at, null);

  const discard = await request
    .delete(`/api/tickets/${ticketId}/comments/${published.body.id}`)
    .set("Authorization", `Bearer ${devAuth.token}`);
  assert.equal(discard.statusCode, 400);
  assert.equal(discard.body.error, "comment_already_published");
});

test("a reporter calling publish or discard gets 403", async () => {
  const draft = await createDraft("Reporter must not be able to release this.");

  const publish = await request
    .post(`/api/tickets/${ticketId}/comments/${draft.id}/publish`)
    .set("Authorization", `Bearer ${reporterAuth.token}`)
    .send({});
  assert.equal(publish.statusCode, 403);

  const discard = await request
    .delete(`/api/tickets/${ticketId}/comments/${draft.id}`)
    .set("Authorization", `Bearer ${reporterAuth.token}`);
  assert.equal(discard.statusCode, 403);

  const stillThere = db
    .prepare("SELECT published_at FROM comments WHERE id = ?")
    .get(draft.id);
  assert.equal(stillThere.published_at, null);
});

test("a reporter cannot create a draft they could never read back", async () => {
  const res = await request
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Authorization", `Bearer ${reporterAuth.token}`)
    .send({ content: "Reporter tries to draft.", publish: false });

  assert.equal(res.statusCode, 403);
});

test("an unpublished closure summary does not satisfy the closure gate", async () => {
  const createTicket = await request
    .post("/api/tickets")
    .set("Authorization", `Bearer ${reporterAuth.token}`)
    .field(makeBugPayload({ title: "Closure gate draft ticket" }));
  assert.equal(createTicket.statusCode, 201);
  const gateTicketId = createTicket.body.id;

  const draftSummary = await request
    .post(`/api/tickets/${gateTicketId}/comments`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({
      content:
        "Draft closure summary that nobody has reviewed yet, so the ticket must not close on it.",
      is_closure_summary: true,
      publish: false
    });
  assert.equal(draftSummary.statusCode, 201);
  assert.equal(draftSummary.body.published_at, null);

  const verify = await request
    .patch(`/api/tickets/${gateTicketId}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "verified" });
  assert.equal(verify.statusCode, 200);

  const close = await request
    .patch(`/api/tickets/${gateTicketId}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "closed" });
  assert.equal(close.statusCode, 400);
  assert.equal(close.body.error, "closure_summary_required");

  const publish = await request
    .post(`/api/tickets/${gateTicketId}/comments/${draftSummary.body.id}/publish`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({});
  assert.equal(publish.statusCode, 200);

  const closeAgain = await request
    .patch(`/api/tickets/${gateTicketId}`)
    .set("Authorization", `Bearer ${devAuth.token}`)
    .send({ status: "closed" });
  assert.equal(closeAgain.statusCode, 200);
});
