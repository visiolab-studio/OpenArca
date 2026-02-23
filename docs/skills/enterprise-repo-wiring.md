# Skill: Enterprise Repo Wiring

## Cel
Podłączyć prywatne repo `OpenArca-Enterprise` do publicznego `OpenArca` bez mieszania kodu.

## Kiedy stosować
- Przy lokalnym developmentcie Enterprise.
- Przy uruchamianiu Open Core z prywatnymi override.

## Kroki
- [ ] Sklonuj repo obok Open Core, np. `../OpenArca-Enterprise`.
- [ ] Utwórz plik override w repo Enterprise:
  `backend/extensions/service-overrides.js`.
- [ ] Ustaw zmienną:
  `EXTENSIONS_OVERRIDES_FILE=../OpenArca-Enterprise/backend/extensions/service-overrides.js`
- [ ] Uruchom stack i sprawdź endpointy feature-gated.

## Przykłady
```bash
export EXTENSIONS_OVERRIDES_FILE=../OpenArca-Enterprise/backend/extensions/service-overrides.js
docker compose up --build -d
```

```js
// OpenArca-Enterprise/backend/extensions/service-overrides.js
module.exports = {
  workflowService(core) {
    return {
      ...core,
      buildEnterpriseCheckPayload(featureKey) {
        return {
          ...core.buildEnterpriseCheckPayload(featureKey),
          source: "enterprise"
        };
      }
    };
  }
};
```

## Definition of Done
- [ ] Open Core działa bez prywatnego repo.
- [ ] Po ustawieniu `EXTENSIONS_OVERRIDES_FILE` override ładuje się poprawnie.
- [ ] Feature-gated endpointy zachowują RBAC i `requireFeature`.

## Najczęstsze błędy / pułapki
- Błędna ścieżka do `service-overrides.js`.
- Wrzucenie kodu Enterprise do publicznego repo Open Core.
- Brak testu po stronie backendu po zmianie override.

## Powiązane pliki w repo
- `backend/config.js`
- `backend/core/extension-registry.js`
- `backend/extensions/README.md`
- `.env.example`
