// Rozwiazywanie etykiety kategorii dla JEZYKA INTERFEJSU.
//
// Kategorie sa konfigurowalne per projekt, ale jezyk nalezy do osoby, nie do
// projektu. Wdrozenie z polskim i wloskim sklepem nie moze pokazywac wloskich
// nazw komus, kto pracuje po polsku — sklep mowi, CZEGO zgloszenie dotyczy,
// a nie w jakim jezyku ktos czyta.
//
// Kolejnosc: tlumaczenie dla biezacego jezyka → tlumaczenie dla jezyka
// zapasowego → etykieta domyslna z konfiguracji. Pole po polu, bo wdrozenie
// moze przetlumaczyc nazwe i jeszcze nie miec opisu.

export const DEFAULT_LANGUAGE = "pl";

function pick(translations, language, field) {
  if (!translations || typeof translations !== "object") return null;
  const entry = translations[language];
  if (!entry || typeof entry !== "object") return null;
  const value = entry[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveCategoryText(entry, language, fallbackLanguage = "en") {
  if (!entry) return { label: null, description: null };

  const translations = entry.translations;
  return {
    label:
      pick(translations, language, "label") ||
      pick(translations, fallbackLanguage, "label") ||
      entry.label ||
      null,
    description:
      pick(translations, language, "description") ||
      pick(translations, fallbackLanguage, "description") ||
      entry.description ||
      null
  };
}

export default resolveCategoryText;
