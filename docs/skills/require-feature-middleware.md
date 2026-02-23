# Skill: requireFeature Middleware

## Cel
Chronić endpointy Enterprise po stronie backendu, niezależnie od ukrywania funkcji w UI.

## Kiedy stosować
- Gdy endpoint ma działać tylko przy aktywnej fladze feature.
- Gdy wdrażasz nowy moduł Enterprise bez forka kodu.

## Kroki
- [ ] Dodaj `requireFeature("<feature_key>")` po `authRequired` i (jeśli trzeba) `requireRole(...)`.
- [ ] Zdefiniuj domyślne capability w serwisie capabilities.
- [ ] Zadbaj o deny-by-default (`403 feature_not_enabled` gdy flaga off).
- [ ] Dodaj testy: brak auth, brak roli, feature off, feature on.
- [ ] Dodaj test smoke istniejących flow, by wykluczyć regresję.

## Przykłady
```js
router.get(
  "/enterprise-check",
  authRequired,
  requireRole("developer"),
  requireFeature("enterprise_automation"),
  handler
);
```

```json
{ "error": "feature_not_enabled", "feature": "enterprise_automation" }
```

## Definition of Done
- [ ] Endpoint nie jest dostępny bez zalogowania.
- [ ] Endpoint nie jest dostępny dla nieuprawnionej roli.
- [ ] Endpoint zwraca `403 feature_not_enabled`, gdy feature wyłączony.
- [ ] Endpoint działa poprawnie po włączeniu capability.

## Najczęstsze błędy / pułapki
- Poleganie tylko na ukryciu przycisku w frontendzie.
- Brak testu dla override feature flag (np. `enterprise` + ręczne wyłączenie flagi).
- Niezgodne nazwy flag między backend i frontend.

## Powiązane pliki w repo
- `backend/middleware/features.js`
- `backend/routes/settings.js`
- `backend/tests/feature.middleware.integration.test.js`
- `backend/services/capabilities.js`
