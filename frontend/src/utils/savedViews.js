const STORAGE_VERSION = 1;

function normalizeString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function normalizeFilters(rawFilters, defaults) {
  const result = { ...defaults };

  for (const key of Object.keys(defaults)) {
    result[key] = normalizeString(rawFilters?.[key], defaults[key]);
  }

  return result;
}

export function areFiltersEqual(left, right, defaults) {
  const normalizedLeft = normalizeFilters(left, defaults);
  const normalizedRight = normalizeFilters(right, defaults);
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

export function loadSavedViewsState(storageKey, defaults) {
  if (typeof window === "undefined" || !window.localStorage) {
    return {
      activeFilters: { ...defaults },
      views: []
    };
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {
        activeFilters: { ...defaults },
        views: []
      };
    }

    const parsed = JSON.parse(raw);
    const views = Array.isArray(parsed?.views)
      ? parsed.views
          .filter((view) => typeof view?.id === "string" && typeof view?.name === "string")
          .map((view) => ({
            id: view.id,
            name: view.name.trim(),
            filters: normalizeFilters(view.filters, defaults)
          }))
          .filter((view) => view.name.length > 0)
      : [];

    return {
      version: parsed?.version === STORAGE_VERSION ? parsed.version : STORAGE_VERSION,
      activeFilters: normalizeFilters(parsed?.activeFilters, defaults),
      views
    };
  } catch {
    return {
      activeFilters: { ...defaults },
      views: []
    };
  }
}

export function saveSavedViewsState(storageKey, defaults, state) {
  if (typeof window === "undefined" || !window.localStorage) return;

  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      version: STORAGE_VERSION,
      activeFilters: normalizeFilters(state?.activeFilters, defaults),
      views: Array.isArray(state?.views)
        ? state.views.map((view) => ({
            id: view.id,
            name: normalizeString(view.name).trim(),
            filters: normalizeFilters(view.filters, defaults)
          }))
        : []
    })
  );
}

export function createSavedView(name, filters, defaults) {
  return {
    id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: normalizeString(name).trim(),
    filters: normalizeFilters(filters, defaults)
  };
}
