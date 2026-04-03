# Skill: Enterprise Route Modules

## Cel
Ładować prywatne trasy Enterprise z osobnego repo bez wrzucania kodu modułów do Open Core.

## Kiedy stosować
- Przy dodawaniu nowego modułu Enterprise z własnymi endpointami.
- Gdy prywatne repo ma montować osobne route handlery i capability gating.

## Kroki
- [ ] Dodaj w OpenArca `EXTENSIONS_ROUTES_FILE` i bezpieczny loader tras.
- [ ] Przekaż do route module tylko kontrolowany kontekst: `express`, `db`, `getService`, `middlewares`.
- [ ] Zachowaj kolejność zabezpieczeń: `authRequired` -> `requireRole` -> `requireFeature`.
- [ ] W prywatnym repo eksportuj funkcję `module.exports = ({ app, ...context }) => { ... }`.
- [ ] Dodaj integracyjny test endpointu z aktywnym i wyłączonym capability.

## Przykłady
```bash
EXTENSIONS_ROUTES_FILE=../OpenArca-Enterprise/backend/extensions/routes.js
```

```bash
docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml up --build -d
```

```js
module.exports = ({ app, express, middlewares }) => {
  const router = express.Router();

  router.get(
    "/api/enterprise/support-threads/health",
    middlewares.authRequired,
    middlewares.requireRole("developer"),
    middlewares.requireFeature("enterprise_support_threads"),
    (_req, res) => res.json({ ok: true })
  );

  app.use(router);
};
```

## Definition of Done
- [ ] Open Core działa bez pliku `routes.js`.
- [ ] Prywatne route module montuje się bez zmian w publicznych route handlerach.
- [ ] Endpointy Enterprise respektują RBAC i capability gating.
- [ ] Test integracyjny potwierdza `403` bez flagi i `200` po włączeniu.

## Najczęstsze błędy / pułapki
- Ładowanie prywatnych tras bez `requireFeature`.
- Bezpośrednie `require` prywatnego repo w publicznych plikach routingu.
- Eksport niebędący funkcją lub `{ register }`.

## Powiązane pliki w repo
- `backend/app.js`
- `backend/config.js`
- `backend/core/routes-extension-loader.js`
- `backend/tests/routes.extension-loader.unit.test.js`
- `backend/tests/enterprise.support-threads.feature.integration.test.js`
- `docker-compose.enterprise.override.yml`
