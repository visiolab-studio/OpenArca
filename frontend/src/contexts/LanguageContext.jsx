import { createContext, useContext, useMemo, useState } from "react";
import i18n from "../i18n";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(
    localStorage.getItem("edudoroit_lang") || "pl"
  );

  function setLanguage(nextLanguage) {
    const normalized = nextLanguage === "en" ? "en" : "pl";
    setLanguageState(normalized);
    localStorage.setItem("edudoroit_lang", normalized);
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
