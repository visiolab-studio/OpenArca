import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import pl from "./pl.json";
import en from "./en.json";
import it from "./it.json";
import config from "./languages.json";
import { getStoredValue } from "../utils/storage";

// languages.json is the single source of truth, shared with the i18n guard, so
// the guard and the runtime cannot disagree about which languages exist.
const dictionaries = { pl, en, it };

export const SUPPORTED_LANGUAGES = config.languages;
export const DEFAULT_LANGUAGE = config.fallback;

export function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

const resources = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((language) => [language, { translation: dictionaries[language] }])
);

const storedLanguage = normalizeLanguage(getStoredValue("edudoroit_lang", DEFAULT_LANGUAGE));

i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
