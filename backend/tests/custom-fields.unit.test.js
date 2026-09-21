const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CustomFieldError,
  validateDefinition,
  validateValue,
  validateSubmission
} = require("../core/custom-fields");

function definition(overrides = {}) {
  return {
    field_key: "order_number",
    label: "Order number",
    field_type: "text",
    required: false,
    options: null,
    ...overrides
  };
}

test("a well-formed definition is accepted", () => {
  assert.equal(validateDefinition(definition()), true);
});

test("field keys are restricted to a machine-safe shape", () => {
  for (const key of ["Order", "1order", "order-number", "o", "", "order number"]) {
    assert.throws(
      () => validateDefinition(definition({ field_key: key })),
      (error) => error instanceof CustomFieldError && error.code === "invalid_field_key",
      `expected "${key}" to be rejected`
    );
  }
});

test("a select field must declare options", () => {
  assert.throws(
    () => validateDefinition(definition({ field_type: "select", options: [] })),
    (error) => error.code === "select_requires_options"
  );
});

test("duplicate select options are rejected", () => {
  assert.throws(
    () => validateDefinition(definition({ field_type: "select", options: ["a", "a"] })),
    (error) => error.code === "duplicate_options"
  );
});

test("an unknown field type is rejected", () => {
  assert.throws(
    () => validateDefinition(definition({ field_type: "markdown" })),
    (error) => error.code === "invalid_field_type"
  );
});

test("a required field rejects empty input, an optional one returns null", () => {
  assert.throws(
    () => validateValue(definition({ required: true }), "   "),
    (error) => error.code === "field_required"
  );
  assert.equal(validateValue(definition(), ""), null);
  assert.equal(validateValue(definition(), undefined), null);
});

test("numbers are validated and normalized", () => {
  const field = definition({ field_type: "number" });
  assert.equal(validateValue(field, " 42 "), "42");
  assert.equal(validateValue(field, "3.50"), "3.5");
  assert.throws(() => validateValue(field, "abc"), (error) => error.code === "invalid_number");
});

test("dates must be real, not merely well shaped", () => {
  const field = definition({ field_type: "date" });
  assert.equal(validateValue(field, "2026-02-28"), "2026-02-28");

  // 2026-02-31 matches YYYY-MM-DD, and Date() would quietly roll it into March.
  assert.throws(() => validateValue(field, "2026-02-31"), (error) => error.code === "invalid_date");
  assert.throws(() => validateValue(field, "28-02-2026"), (error) => error.code === "invalid_date");
});

test("only http and https URLs are accepted", () => {
  const field = definition({ field_type: "url" });
  assert.equal(validateValue(field, "https://example.test/a"), "https://example.test/a");

  // These values render as clickable links for developers, so a javascript: or
  // data: URL here would be a stored XSS vector.
  for (const value of ["javascript:alert(1)", "data:text/html,<script>", "ftp://example.test"]) {
    assert.throws(
      () => validateValue(field, value),
      (error) => error.code === "invalid_url",
      `expected "${value}" to be rejected`
    );
  }
});

test("select values must be one of the declared options", () => {
  const field = definition({ field_type: "select", options: JSON.stringify(["pl", "it"]) });
  assert.equal(validateValue(field, "it"), "it");
  assert.throws(() => validateValue(field, "de"), (error) => error.code === "invalid_option");
});

test("over-long values are rejected", () => {
  assert.throws(
    () => validateValue(definition(), "x".repeat(2001)),
    (error) => error.code === "value_too_long"
  );
});

test("a submission is normalized against the definitions", () => {
  const definitions = [
    definition({ field_key: "order_number" }),
    definition({ field_key: "amount", field_type: "number" })
  ];

  assert.deepEqual(validateSubmission(definitions, { order_number: " A-1 ", amount: "10" }), {
    order_number: "A-1",
    amount: "10"
  });
});

test("an unknown key is refused rather than silently dropped", () => {
  // Dropping a value the caller believed was saved is worse than refusing it.
  assert.throws(
    () => validateSubmission([definition()], { order_number: "A-1", nope: "x" }),
    (error) => error.code === "unknown_field" && error.field === "nope"
  );
});

test("omitted optional fields simply do not appear", () => {
  const definitions = [definition({ field_key: "a" }), definition({ field_key: "b" })];
  assert.deepEqual(validateSubmission(definitions, { a: "1" }), { a: "1" });
});

test("a missing required field fails the whole submission", () => {
  const definitions = [definition({ field_key: "a", required: true })];
  assert.throws(
    () => validateSubmission(definitions, {}),
    (error) => error.code === "field_required" && error.field === "a"
  );
});
