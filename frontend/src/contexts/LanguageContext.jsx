import { createContext, useContext, useMemo, useState } from "react";
import i18n, { normalizeLanguage, DEFAULT_LANGUAGE } from "../i18n";
import { getStoredValue, setStoredValue } from "../utils/storage";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(
    normalizeLanguage(getStoredValue("edudoroit_lang", DEFAULT_LANGUAGE))
  );

  function setLanguage(nextLanguage) {
    const normalized = normalizeLanguage(nextLanguage);
    setLanguageState(normalized);
    setStoredValue("edudoroit_lang", normalized);
    i18n.changeLanguage(normalized);
  }

  const value = useMemo(
    () => ({
      language,
      setLanguage
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
