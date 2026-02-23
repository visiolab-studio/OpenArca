# Skill: Open/Enterprise Engine Split

## Cel
Oddzielić Open Core od Enterprise przez extension points, bez duplikowania i bez forka kodu open.

## Kiedy stosować
- Przy budowie funkcji Enterprise, które mają żyć poza publicznym repo.
- Gdy chcesz umożliwić nadpisania custom przez osobne moduły.

## Kroki
- [ ] Utrzymuj core usługi w `backend/core/services/*`.
- [ ] Rejestruj usługi przez `backend/core/extension-registry.js`.
- [ ] Ładuj override opcjonalnie z `backend/extensions/service-overrides.js`.
- [ ] Zachowaj kolejność zabezpieczeń endpointu: `authRequired` -> `requireRole` -> `requireFeature` -> service.
- [ ] Dodaj test registry (fallback core + override function/object).
- [ ] Dodaj test integracyjny endpointu wykorzystującego service layer.

## Przykłady
```js
const { getService } = require("../core/extension-registry");
const workflowService = getService("workflowService");
const payload = workflowService.buildEnterpriseCheckPayload("enterprise_automation");
```

```js
// backend/extensions/service-overrides.js
module.exports = {
  workflowService(core) {
    return { ...core, provider: "enterprise" };
  }
};
```

## Definition of Done
- [ ] Open działa bez katalogu override.
- [ ] Override można dodać bez zmiany kodu core.
- [ ] Testy backend i smoke E2E przechodzą.

## Najczęstsze błędy / pułapki
- Mieszanie logiki enterprise bezpośrednio w route handlerach core.
- Brak fallbacku, gdy override nie istnieje.
- Brak testu dla niepoprawnego formatu override.

## Powiązane pliki w repo
- `backend/core/extension-registry.js`
- `backend/core/services/ticketService.js`
- `backend/core/services/workflowService.js`
- `backend/core/services/taskSyncService.js`
- `backend/extensions/README.md`
- `backend/tests/extension.registry.unit.test.js`
