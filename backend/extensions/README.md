# Extensions Layer

Ten katalog jest punktem integracji prywatnych modułów Enterprise lub custom override.

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
