# Skill: Capabilities Foundation (Open Core + Enterprise)

## Cel
Utrzymać jeden silnik aplikacji z kontrolą funkcji przez `edition` i `feature_flags` bez forka kodu.

## Kiedy stosować
- Przy dodawaniu nowej funkcji, która ma być włączana warunkowo.
- Przy przygotowaniu endpointów/middleware pod rozdział Open Core vs Enterprise.
- Przy walidacji, czy frontend poprawnie ukrywa/pokazuje funkcje wg capabilities.

## Kroki
- [ ] Dodaj/utrzymaj klucze settings: `edition`, `feature_flags` (JSON).
- [ ] Znormalizuj `edition` do dozwolonych wartości (`open_core`, `enterprise`).
- [ ] Zbuduj finalną mapę capabilities z bezpiecznych defaults (deny-by-default dla enterprise).
- [ ] Wystaw `GET /api/settings/capabilities` z `authRequired`.
- [ ] Po stronie frontendu dodaj `useCapabilities()` i `hasFeature(flag)`.
- [ ] Dla endpointów enterprise-only użyj `requireFeature(...)` (gdy middleware jest dostępny).
- [ ] Uruchom testy RBAC/ownership + smoke.

## Przykłady
```bash
# Odczyt capabilities (z tokenem)
curl -s http://localhost:4000/api/settings/capabilities \
  -H "Authorization: Bearer <JWT>"
```

```json
{
  "edition": "open_core",
  "capabilities": {
    "core_tickets": true,
    "enterprise_automation": false
  }
}
```

## Definition of Done
- [ ] `GET /api/settings/capabilities` zwraca stabilny payload i wymaga auth.
- [ ] Dla `open_core` funkcje enterprise domyślnie są wyłączone.
- [ ] Frontend `useCapabilities()` obsługuje sukces i fallback błędu.
- [ ] Testy backend + frontend + smoke przechodzą.

## Najczęstsze błędy / pułapki
- Trzymanie `feature_flags` jako niepoprawnego JSON bez fallbacku.
- Nadpisywanie core flags przez przypadek przy merge.
- Ukrywanie funkcji tylko w UI bez ochrony backendowej.

## Powiązane pliki w repo
- `backend/constants.js`
- `backend/db.js`
- `backend/services/capabilities.js`
- `backend/routes/settings.js`
- `backend/tests/capabilities.integration.test.js`
- `frontend/src/api/settings.js`
- `frontend/src/contexts/CapabilitiesContext.jsx`
- `frontend/src/contexts/__tests__/CapabilitiesContext.test.jsx`
