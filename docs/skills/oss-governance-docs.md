# Skill: OSS Governance Docs

## Cel
Dostarczyć minimalny, operacyjny pakiet dokumentów open-source: zasady współpracy, bezpieczeństwo, kodeks postępowania, changelog i roadmapa publiczna.

## Kiedy stosować
- Repo przygotowuje się do publicznego Open Core.
- Brakuje podstawowych artefaktów governance.
- Trzeba ujednolicić oczekiwania dla contributorów.

## Kroki (checklista)
- [ ] Dodaj `CONTRIBUTING.md` (workflow PR, quality gates, standard commitów).
- [ ] Dodaj `LICENSE` (zalecane: jawny SPDX + docelowa licencja projektu).
- [ ] Dodaj `SECURITY.md` (kanał zgłoszeń, disclosure, SLA odpowiedzi).
- [ ] Dodaj `CODE_OF_CONDUCT.md`.
- [ ] Dodaj `CHANGELOG.md` (sekcja `Unreleased`).
- [ ] Dodaj publiczną roadmapę (`ROADMAP.md`).
- [ ] Podlinkuj governance docs z `README.md`.
- [ ] Uruchom pełne quality gates + smoke E2E (zgodnie z procesem projektu).

## Przykłady
Dokumenty:
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `CHANGELOG.md`
- `ROADMAP.md`

## Definition of Done
- [ ] Wszystkie dokumenty governance istnieją i mają praktyczną zawartość.
- [ ] Licencja jest jednoznacznie określona (SPDX + plik `LICENSE`).
- [ ] `README.md` linkuje pakiet governance.
- [ ] Testy i smoke E2E przechodzą.

## Najczęstsze błędy / pułapki
- Zbyt ogólne dokumenty bez konkretnego workflow.
- Brak polityki odpowiedzialnego ujawniania podatności.
- Brak rozróżnienia roadmapy publicznej i planu wewnętrznego.
- Brak aktualizacji changeloga przy zmianach release’owych.

## Powiązane pliki w repo
- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `docs/PROGRESS.md`

## Manual test
- Otwórz README i sprawdź sekcję Governance Open Source.
- Oczekiwany rezultat: komplet linków do dokumentów governance.
