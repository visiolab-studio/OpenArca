# Skill: Saved Views And Filter Presets

## Cel
Wdrożyć lekkie `saved views` dla widoków operacyjnych bez backendu, z szybkim efektem UX i bez mieszania tego z funkcjami Enterprise.

## Kiedy stosować
- Gdy użytkownik chce zapamiętywać własne filtry w `My Tickets`, `Board` albo `DevTodo`.
- Gdy dodajesz szybkie presety typu `Blocked`, `Waiting`, `This week`.
- Gdy potrzebny jest szybki MVP bez współdzielonych widoków i bez modelu serwerowego.

## Kroki
- [ ] Zacznij od lokalnego storage (`localStorage`) per widok i osobnego klucza namespacowanego.
- [ ] Zdefiniuj jeden obiekt `DEFAULT_FILTERS` i normalizuj wszystkie odczyty/zapisy przez helper.
- [ ] Rozdziel dwa pojęcia:
  - aktywne filtry przywracane po odświeżeniu,
  - lista zapisanych widoków użytkownika.
- [ ] Dodaj mały zestaw presetów odpowiadających realnym scenariuszom pracy.
- [ ] Dodaj przyciski: zapisz widok, wybierz widok, usuń widok, reset filtrów.
- [ ] Przy zmianie filtrów ręcznie czyść zaznaczenie aktywnego saved view, jeśli widok przestaje być 1:1 zgodny.
- [ ] Dodaj test frontendowy:
  - preset zmienia listę wyników,
  - zapisany widok wraca po resecie filtrów.

## Przykłady
```js
const DEFAULT_FILTERS = {
  status: "",
  priority: "",
  projectId: "",
  sortBy: "updated_at"
};

const state = loadSavedViewsState("openarca.myTickets.savedViews.v1", DEFAULT_FILTERS);
saveSavedViewsState("openarca.myTickets.savedViews.v1", DEFAULT_FILTERS, {
  activeFilters: filters,
  views: savedViews
});
```

Przykładowe presety:
- `My critical`
- `Waiting`
- `Blocked`
- `This week`
- `Unassigned` dla widoków developerskich

Przykład dla Kanban:
```js
const DEFAULT_FILTERS = {
  projectId: "",
  category: "",
  priority: "",
  statusScope: "",
  plannedWindow: ""
};
```

Preset `This week` w Kanban może działać na `planned_date`, nawet jeśli ten filtr nie ma osobnego pola formularza.

## Definition of Done
- [ ] Filtry widoku wracają po odświeżeniu strony.
- [ ] Użytkownik może zapisać i usunąć własny widok.
- [ ] Presety faktycznie zmieniają zakres listy, a nie tylko UI.
- [ ] MVP nie wymaga zmian backendu.
- [ ] Test frontendowy przechodzi.

## Najczęstsze błędy / pułapki
- Zapisywanie nienormalizowanego payloadu i późniejsze rozjazdy typów.
- Mieszanie filtrów prywatnych usera z konfiguracją instancji.
- Wprowadzanie współdzielonych/team views za wcześnie.
- Preset, który nie odpowiada semantyce istniejących filtrów.

## Powiązane pliki w repo
- `frontend/src/pages/MyTickets.jsx`
- `frontend/src/pages/Board.jsx`
- `frontend/src/utils/savedViews.js`
- `frontend/src/pages/__tests__/MyTickets.savedViews.test.jsx`
- `frontend/src/pages/__tests__/Board.savedViews.test.jsx`
