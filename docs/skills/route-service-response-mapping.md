# Skill: Route -> Service -> Response Mapping

## Cel
Utrzymać cienkie route handlery i przenieść logikę domenową do testowalnych service modules.

## Kiedy stosować
- Gdy endpoint ma więcej niż proste `SELECT/UPDATE`.
- Gdy chcemy łatwo podmieniać logikę przez extension registry.

## Kroki
- [ ] W route zostaw: walidacja -> auth -> service -> response.
- [ ] Logikę biznesową przenieś do `backend/services/*`.
- [ ] Service powinien mieć funkcję fabrykującą (`create...Service`) dla testów DI.
- [ ] Sprawdź kontrakt zależności i rzucaj jawny błąd dla niepoprawnego provider.
- [ ] Dodaj testy unit service + utrzymaj test integracyjny endpointu.

## Przykłady
```js
// route
const payload = enterpriseCheckService.buildPayload("enterprise_automation");
return res.json(payload);
```

```js
// service
function createEnterpriseCheckService({ getWorkflowService }) {
  return {
    buildPayload(featureKey) { /* domain logic */ }
  };
}
```

## Definition of Done
- [ ] Route handler ma minimalną logikę.
- [ ] Service ma testy unit.
- [ ] Endpoint zachowuje kontrakt odpowiedzi.

## Najczęstsze błędy / pułapki
- Przeniesienie części logiki do service, a części pozostawienie w route.
- Brak walidacji kontraktu dependency-injection.
- Brak zachowania kompatybilności payloadu odpowiedzi.

## Powiązane pliki w repo
- `backend/routes/settings.js`
- `backend/services/enterpriseCheck.js`
- `backend/tests/enterprise.check.service.unit.test.js`
