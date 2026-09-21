const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const {
  CORE_CATEGORY_KEYS,
  installCategorySchema,
  createCategoriesService,
  validateDefinition
} = require("../core/categories");

function createDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openarca-categories-"));
  const db = new Database(path.join(dir, "test.sqlite"));
  db.prepare("CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT)").run();
  installCategorySchema(db);
  db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Sklep')").run();
  db.prepare("INSERT INTO projects (id, name) VALUES ('p2', 'Wewnetrzny')").run();
  return { db, dir };
}

test("a project that configures nothing keeps the built-in categories", () => {
  const { db, dir } = createDb();
  const service = createCategoriesService({ db });

  // This is what protects every existing installation from the change.
  assert.deepEqual(service.effectiveKeys("p1"), CORE_CATEGORY_KEYS);
  assert.deepEqual(service.describe("p1").map((c) => c.source), CORE_CATEGORY_KEYS.map(() => "core"));

  fs.rmSync(dir, { recursive: true, force: true });
});

test("a configured project replaces the built-ins rather than adding to them", () => {
  const { db, dir } = createDb();
  const service = createCategoriesService({ db });

  service.upsert({ projectId: "p1", payload: { category_key: "data_check", label: "Sprawdzenie danych", position: 0 } });
  service.upsert({ projectId: "p1", payload: { category_key: "billing", label: "Płatności", position: 1 } });

  // No merge: a deployment defining its own taxonomy means it, and quietly
  // keeping "improvement" around would undo the point of configuring anything.
  assert.deepEqual(service.effectiveKeys("p1"), ["data_check", "billing"]);
  assert.ok(!service.effectiveKeys("p1").includes("improvement"));

  fs.rmSync(dir, { recursive: true, force: true });
});

test("categories are per project", () => {
  const { db, dir } = createDb();
  const service = createCategoriesService({ db });

  service.upsert({ projectId: "p1", payload: { category_key: "billing", label: "Płatności" } });

  assert.deepEqual(service.effectiveKeys("p1"), ["billing"]);
  assert.deepEqual(service.effectiveKeys("p2"), CORE_CATEGORY_KEYS);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("a category outside the project's list is refused, naming the valid ones", () => {
  const { db, dir } = createDb();
  const service = createCategoriesService({ db });
  service.upsert({ projectId: "p1", payload: { category_key: "billing", label: "Płatności" } });

  assert.throws(
    () => service.assertValid({ projectId: "p1", category: "bug" }),
    (error) => error.code === "invalid_category" && /billing/.test(error.message)
  );

  fs.rmSync(dir, { recursive: true, force: true });
});

test("a project with no configuration still accepts the built-ins", () => {
  const { db, dir } = createDb();
  const service = createCategoriesService({ db });

  assert.equal(service.assertValid({ projectId: "p2", category: "bug" }), "bug");
  assert.equal(service.assertValid({ projectId: null, category: "other" }), "other");

  fs.rmSync(dir, { recursive: true, force: true });
});

test("archiving hides a category without orphaning past tickets", () => {
  const { db, dir } = createDb();
  const service = createCategoriesService({ db });
  service.upsert({ projectId: "p1", payload: { category_key: "billing", label: "Płatności" } });
  service.upsert({ projectId: "p1", payload: { category_key: "legal", label: "Prawne" } });

  service.archive({ projectId: "p1", categoryKey: "legal" });

  // The row survives, so a ticket already filed as `legal` still resolves.
  assert.deepEqual(service.effectiveKeys("p1"), ["billing"]);
  assert.equal(
    db.prepare("SELECT COUNT(*) c FROM project_categories WHERE category_key = 'legal'").get().c,
    1
  );

  fs.rmSync(dir, { recursive: true, force: true });
});

test("category keys are restricted to a machine-safe shape", () => {
  for (const key of ["Billing", "1billing", "bill-ing", "b", ""]) {
    assert.throws(
      () => validateDefinition({ category_key: key, label: "x" }),
      (error) => error.code === "invalid_category_key",
      `expected "${key}" to be rejected`
    );
  }
});

test("a label is required", () => {
  assert.throws(
    () => validateDefinition({ category_key: "billing", label: "   " }),
    (error) => error.code === "invalid_category_label"
  );
});
