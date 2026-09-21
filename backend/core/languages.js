// Single source of truth for supported UI and email languages.
//
// Previously each site did its own `lang === "en" ? "en" : "pl"`, which silently
// collapsed any third language back to Polish — an Italian user would have been
// told their language was saved and then received Polish email.
//
// Keep this list in step with frontend/src/i18n/languages.json.

const SUPPORTED_LANGUAGES = ["pl", "en", "it"];
const DEFAULT_LANGUAGE = "pl";

function normalizeLanguage(value) {
  const candidate = String(value || "").trim().toLowerCase();
  return SUPPORTED_LANGUAGES.includes(candidate) ? candidate : DEFAULT_LANGUAGE;
}

// Picks a translation from a { pl, en, it } map, falling back to the default
// language when a language is missing an entry — a missing translation should
// degrade to readable text, never to `undefined` in a subject line.
function translate(lang, translations) {
  const normalized = normalizeLanguage(lang);
  const value = translations[normalized];
  return value === undefined ? translations[DEFAULT_LANGUAGE] : value;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  translate
};
