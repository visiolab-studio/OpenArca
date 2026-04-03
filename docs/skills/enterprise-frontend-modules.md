# Skill: Enterprise Frontend Modules

## Cel
Ładować prywatne widoki i sekcje menu Enterprise z osobnego repo bez kopiowania kodu UI do Open Core.

## Kiedy stosować
- Przy dodawaniu nowego ekranu Enterprise w sidebarze lub routerze.
- Gdy prywatne repo ma dostarczyć własne strony React z feature gatingiem.
- Gdy OpenArca ma działać poprawnie także bez prywatnego repo.

## Kroki
- [ ] W OpenArca dodaj stub `frontend/src/enterprise/extensions.stub.jsx`.
- [ ] W `vite.config.js` rozwiąż alias `virtual:enterprise-frontend` do prywatnego pliku lub stubu.
- [ ] Zaaliasuj współdzielone paczki (`react`, `react-dom`, `react-i18next`, `lucide-react`) do `node_modules` publicznego frontendu, żeby build działał także dla plików poza repo Open Core.
- [ ] W `App.jsx` renderuj prywatne route definitions przez `FeatureRoute` i opcjonalnie `DeveloperRoute`.
- [ ] W `AppShell.jsx` dodaj sekcje menu z `enterpriseNavSections`, filtrowane po capability.
- [ ] W prywatnym repo eksportuj `enterpriseRoutes` i `enterpriseNavSections`.
- [ ] Trzymaj prywatne API/helpery i style obok modułu, nie w Open Core.
- [ ] Dodaj testy dla feature-gated routingu i dla co najmniej jednego prywatnego widoku przez alias.

## Przykłady
```js
export const enterpriseRoutes = [
  {
    path: "/support-threads",
    component: SupportThreadsInboxPage,
    featureKey: "enterprise_support_threads",
    requiresDeveloper: true
  }
];
```

```js
export const enterpriseNavSections = [
  {
    labelKey: "nav.enterprise",
    items: [
      {
        to: "/support-threads",
        labelKey: "nav.supportThreads",
        featureKey: "enterprise_support_threads",
        icon: MessageSquareMore
      }
    ]
  }
];
```

```bash
docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml up --build -d
```

## Definition of Done
- [ ] OpenArca uruchamia się bez prywatnego repo i używa stubu.
- [ ] Po podpięciu repo Enterprise sidebar pokazuje tylko aktywne sekcje modułów.
- [ ] Trasa prywatna jest osłonięta feature gatingiem i, jeśli trzeba, rolą developera.
- [ ] Frontend test potwierdza render prywatnego widoku przez alias `virtual:enterprise-frontend`.
- [ ] Build publicznego frontendu przechodzi z podpiętym modułem Enterprise.

## Najczęstsze błędy / pułapki
- Twarde importy prywatnych plików bez fallback stubu.
- Importy do współdzielonych paczek z plików poza repo bez aliasów Vite do publicznego `node_modules`.
- Render sekcji menu bez sprawdzenia capability.
- Prywatny widok zależny od tłumaczeń lub helperów, których nie ma w Open Core.
- Brak testu aliasu `virtual:enterprise-frontend`, przez co regresja wychodzi dopiero na buildzie.

## Powiązane pliki w repo
- `frontend/src/App.jsx`
- `frontend/src/components/AppShell.jsx`
- `frontend/src/components/FeatureRoute.jsx`
- `frontend/src/enterprise/extensions.stub.jsx`
- `frontend/vite.config.js`
- `docker-compose.enterprise.override.yml`
- `frontend/src/pages/__tests__/SupportThreadsInbox.enterprise.test.jsx`
