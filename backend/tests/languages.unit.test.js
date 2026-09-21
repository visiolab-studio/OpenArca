const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  translate
} = require("../core/languages");

test("Italian is supported alongside Polish and English", () => {
  assert.deepEqual(SUPPORTED_LANGUAGES, ["pl", "en", "it"]);
  assert.equal(DEFAULT_LANGUAGE, "pl");
});

test("a supported language is preserved rather than collapsed to the default", () => {
  // The bug this guards: `lang === "en" ? "en" : "pl"` silently turned Italian
  // into Polish, so an Italian user was told their choice was saved and then
  // received Polish email.
  assert.equal(normalizeLanguage("it"), "it");
  assert.equal(normalizeLanguage("en"), "en");
  assert.equal(normalizeLanguage("pl"), "pl");
});

test("unknown, empty and malformed values fall back to the default", () => {
  assert.equal(normalizeLanguage("de"), "pl");
  assert.equal(normalizeLanguage(""), "pl");
  assert.equal(normalizeLanguage(null), "pl");
  assert.equal(normalizeLanguage(undefined), "pl");
  assert.equal(normalizeLanguage(42), "pl");
});

test("case and surrounding whitespace do not defeat the match", () => {
  assert.equal(normalizeLanguage(" IT "), "it");
  assert.equal(normalizeLanguage("EN"), "en");
});

test("translate picks the requested language", () => {
  const copy = { pl: "polski", en: "english", it: "italiano" };
  assert.equal(translate("it", copy), "italiano");
  assert.equal(translate("en", copy), "english");
  assert.equal(translate("pl", copy), "polski");
});

test("a missing translation degrades to the default language, never undefined", () => {
  // A subject line reading "undefined" is worse than one in the wrong language.
  const partial = { pl: "polski", en: "english" };
  assert.equal(translate("it", partial), "polski");
});

test("translate normalizes before looking up", () => {
  const copy = { pl: "polski", en: "english", it: "italiano" };
  assert.equal(translate("de", copy), "polski");
  assert.equal(translate(" IT ", copy), "italiano");
});
