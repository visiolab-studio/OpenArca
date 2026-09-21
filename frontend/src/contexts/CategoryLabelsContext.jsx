import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getProjects, getProjectCategories } from "../api/projects";
import { useAuth } from "./AuthContext";
import { DEFAULT_LANGUAGE, resolveCategoryText } from "../utils/categoryLabel";

// Jedno miejsce, ktore wie, jak nazywa sie kategoria.
//
// Kategorie konfigurowalne zlamaly zalozenie reszty aplikacji: listy, tablica
// i szczegoly zgloszenia tlumaczyly kategorie przez slownik UI, wiec klucz
// spoza wbudowanej piatki (np. `data_check`) wyswietlal sie jako goly
// `category.data_check`. Konfiguracja jest per projekt, wiec sam klucz nie
// wystarcza — rozwiazanie zawsze potrzebuje projektu.

const CategoryLabelsContext = createContext(null);

export function CategoryLabelsProvider({ children }) {
  const { t, i18n } = useTranslation();
  const language = i18n?.language || DEFAULT_LANGUAGE;
  const { user } = useAuth();
  const [byProject, setByProject] = useState({});

  // Zalezne od zalogowanej osoby: przed logowaniem /api/projects odpowie 401,
  // a po logowaniu nikt by tego nie pobral drugi raz.
  useEffect(() => {
    let active = true;
    if (!user) {
      setByProject({});
      return undefined;
    }

    async function load() {
      let projects = [];
      try {
        projects = await getProjects();
      } catch (_error) {
        return; // bez projektow zostaje slownik UI — dokladnie jak wczesniej
      }

      const entries = await Promise.all(
        (projects || []).map(async (project) => {
          try {
            return [project.id, await getProjectCategories(project.id)];
          } catch (_error) {
            return [project.id, []];
          }
        })
      );

      if (active) setByProject(Object.fromEntries(entries));
    }

    load();
    return () => {
      active = false;
    };
  }, [user]);

  // Slownik UI zostaje ostatnia deska ratunku: wbudowane kategorie nie maja
  // wpisu w bazie, a projekt, ktory niczego nie skonfigurowal, ma je dalej.
  const labelFor = useCallback(
    (projectId, key) => {
      if (!key) return "";
      const entry = (byProject[projectId] || []).find((row) => row.key === key);
      const resolved = resolveCategoryText(entry, language);
      if (resolved.label) return resolved.label;

      const dictionary = t(`category.${key}`);
      return dictionary === `category.${key}` ? key : dictionary;
    },
    [byProject, language, t]
  );

  const descriptionFor = useCallback(
    (projectId, key) => {
      const entry = (byProject[projectId] || []).find((row) => row.key === key);
      return resolveCategoryText(entry, language).description;
    },
    [byProject, language]
  );

  // Filtry na liscie i tablicy sa MIEDZY projektami, wiec potrzebuja sumy
  // kluczy. Ten sam klucz w dwoch projektach to ta sama kategoria robocza —
  // wygrywa pierwsza napotkana etykieta, bo filtr i tak filtruje po kluczu.
  const allCategories = useMemo(() => {
    const seen = new Map();
    for (const rows of Object.values(byProject)) {
      for (const row of rows) {
        if (seen.has(row.key)) continue;
        const resolved = resolveCategoryText(row, language);
        seen.set(row.key, resolved.label || row.key);
      }
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [byProject, language]);

  const value = useMemo(
    () => ({
      labelFor,
      descriptionFor,
      allCategories,
      categoriesFor: (id) => byProject[id] || []
    }),
    [labelFor, descriptionFor, allCategories, byProject]
  );

  return (
    <CategoryLabelsContext.Provider value={value}>{children}</CategoryLabelsContext.Provider>
  );
}

// Poza providerem (np. w tescie jednej strony) zwracamy surowy klucz zamiast
// rzucac wyjatkiem: nazwa kategorii to tresc, nie uprawnienie, i nie ma powodu,
// zeby jej brak wywracal strone.
const NO_PROVIDER_FALLBACK = {
  labelFor: (_projectId, key) => key || "",
  descriptionFor: () => null,
  allCategories: [],
  categoriesFor: () => []
};

export function useCategoryLabels() {
  return useContext(CategoryLabelsContext) || NO_PROVIDER_FALLBACK;
}
