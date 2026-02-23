# Extensions Layer

Ten katalog jest punktem integracji prywatnych modułów Enterprise lub custom override.

## Konfiguracja ścieżki z ENV
Możesz wskazać override z zewnętrznego repo (np. `OpenArca-Enterprise`):

- `EXTENSIONS_DIR` - katalog z rozszerzeniami (opcjonalnie)
- `EXTENSIONS_OVERRIDES_FILE` - pełna lub względna ścieżka do pliku override

Przykład:

```bash
EXTENSIONS_OVERRIDES_FILE=../OpenArca-Enterprise/backend/extensions/service-overrides.js
```

## Plik override
Utwórz plik `backend/extensions/service-overrides.js` i eksportuj obiekt:

```js
module.exports = {
  workflowService(coreService) {
    return {
      ...coreService,
      buildEnterpriseCheckPayload(featureKey) {
        const payload = coreService.buildEnterpriseCheckPayload(featureKey);
        return {
          ...payload,
          source: "enterprise-override"
        };
      }
    };
  }
};
```

## Zasady
- Open Core działa bez tego pliku.
- Override może być:
  - funkcją `(coreService) => nextService`,
  - obiektem rozszerzającym metody core serwisu.
- Dla bezpieczeństwa walidacja jest po stronie backend middleware (`RBAC`, `requireFeature`).
