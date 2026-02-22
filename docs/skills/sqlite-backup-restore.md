# Skill: SQLite Backup Restore

## Cel
Zapewnić bezpieczny backup i restore danych aplikacji (`SQLite` + `uploads`) w lokalnym środowisku Docker Compose.

## Kiedy stosować
- Przed większym refactorem lub migracją.
- Przed testami potencjalnie destrukcyjnymi.
- Przy odtwarzaniu środowiska po awarii/regresji.

## Kroki (checklista)
- [ ] Wykonaj backup: `./scripts/backup.sh`.
- [ ] Zweryfikuj, że plik `.tar.gz` powstał w katalogu `backups/`.
- [ ] Przy restore podaj świadomie plik i potwierdzenie `--yes`.
- [ ] Po restore sprawdź health stacka (`docker compose ps`, `/health`).
- [ ] Zweryfikuj kluczowe flow (OTP login + ticket detail).

## Przykłady
```bash
./scripts/backup.sh
./scripts/backup.sh --output backups/edudoroit-backup-manual.tar.gz
./scripts/restore.sh --input backups/edudoroit-backup-manual.tar.gz --yes
```

Makefile:
```bash
make backup
make restore BACKUP=backups/edudoroit-backup-manual.tar.gz
```

## Definition of Done
- [ ] Backup archiwizuje `data/` i `uploads/`.
- [ ] Restore odtwarza dane bez błędów i restartuje wcześniej uruchomione usługi.
- [ ] Aplikacja działa po restore (frontend/backend healthy).
- [ ] Smoke E2E baseline przechodzi.

## Najczęstsze błędy / pułapki
- Restore bez wcześniejszego backupu.
- Przywrócenie niewłaściwego pliku środowiskowego.
- Przerywanie restore w trakcie ekstrakcji.
- Zakładanie spójności backupu `--hot` podczas intensywnych zapisów.

## Powiązane pliki w repo
- `scripts/backup.sh`
- `scripts/restore.sh`
- `README.md`
- `docs/PROGRESS.md`

## Manual test UI/API
- Po restore zaloguj się OTP i otwórz ticket detail.
- Oczekiwany rezultat: dane ticketu i załączniki są dostępne.
