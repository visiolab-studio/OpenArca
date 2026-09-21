const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeOrigin,
  parseOriginList,
  resolveAllowedOrigins,
  isAllowedOrigin,
  resolveRequestOrigin
} = require("../core/hosts");

const ALLOWED = ["https://desk.example.test", "https://pomoc.example.test"];

function request(headers) {
  return { headers };
}

test("origins are normalized to scheme and authority", () => {
  assert.equal(normalizeOrigin("https://desk.example.test/some/path"), "https://desk.example.test");
  assert.equal(normalizeOrigin(" desk.example.test "), "https://desk.example.test");
  assert.equal(normalizeOrigin("http://localhost:3330"), "http://localhost:3330");
});

test("non-http schemes are refused", () => {
  assert.equal(normalizeOrigin("javascript:alert(1)"), null);
  assert.equal(normalizeOrigin("file:///etc/passwd"), null);
  assert.equal(normalizeOrigin(""), null);
  assert.equal(normalizeOrigin(null), null);
});

test("a list is parsed, de-duplicated and order preserved", () => {
  assert.deepEqual(
    parseOriginList("https://a.test, https://b.test ,https://a.test, ,nonsense::"),
    ["https://a.test", "https://b.test"]
  );
});

test("a single-host install keeps working with no new configuration", () => {
  assert.deepEqual(resolveAllowedOrigins({ env: { FRONTEND_ORIGIN: "https://only.test" } }), [
    "https://only.test"
  ]);
  assert.deepEqual(resolveAllowedOrigins({ env: { APP_URL: "https://only.test" } }), [
    "https://only.test"
  ]);
});

test("ALLOWED_HOSTS wins over the single-host variables", () => {
  const origins = resolveAllowedOrigins({
    env: { ALLOWED_HOSTS: "https://a.test,https://b.test", FRONTEND_ORIGIN: "https://c.test" }
  });
  assert.deepEqual(origins, ["https://a.test", "https://b.test"]);
});

test("a request to an allowed host resolves to that host", () => {
  assert.equal(
    resolveRequestOrigin(request({ host: "pomoc.example.test" }), ALLOWED),
    "https://pomoc.example.test"
  );
});

test("an unrecognised host falls back to canonical and is never echoed", () => {
  // This is the attack: a reflected host would put an attacker's domain into an
  // OTP email, and OTP is the only way into the product.
  const resolved = resolveRequestOrigin(request({ host: "evil.example.com" }), ALLOWED);

  assert.equal(resolved, "https://desk.example.test");
  assert.ok(!resolved.includes("evil"));
});

test("X-Forwarded-Host is honoured only when it matches the allowlist", () => {
  assert.equal(
    resolveRequestOrigin(
      request({ host: "internal", "x-forwarded-host": "pomoc.example.test" }),
      ALLOWED
    ),
    "https://pomoc.example.test"
  );

  assert.equal(
    resolveRequestOrigin(
      request({ host: "desk.example.test", "x-forwarded-host": "evil.example.com" }),
      ALLOWED
    ),
    "https://desk.example.test"
  );
});

test("only the first hop of a forwarded chain is considered", () => {
  // A proxy may append; later entries are attacker-controllable.
  assert.equal(
    resolveRequestOrigin(
      request({ "x-forwarded-host": "evil.example.com, pomoc.example.test" }),
      ALLOWED
    ),
    "https://desk.example.test"
  );
});

test("a host header carrying a full URL cannot smuggle another origin", () => {
  assert.equal(
    resolveRequestOrigin(request({ host: "https://evil.example.com" }), ALLOWED),
    "https://desk.example.test"
  );
});

test("a bare host matches regardless of scheme", () => {
  assert.equal(
    resolveRequestOrigin(request({ host: "desk.example.test" }), [
      "http://desk.example.test"
    ]),
    "http://desk.example.test"
  );
});

test("no request and no allowlist degrade predictably", () => {
  assert.equal(resolveRequestOrigin(null, ALLOWED), "https://desk.example.test");
  assert.equal(resolveRequestOrigin(request({ host: "anything" }), []), null);
});

test("membership checks normalize before comparing", () => {
  assert.equal(isAllowedOrigin("https://desk.example.test/path", ALLOWED), true);
  assert.equal(isAllowedOrigin("https://evil.example.com", ALLOWED), false);
  assert.equal(isAllowedOrigin("javascript:alert(1)", ALLOWED), false);
});
