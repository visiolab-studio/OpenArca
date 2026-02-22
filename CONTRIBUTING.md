# Contributing to EdudoroIT_SupportCenter

Thanks for contributing.

## Scope
- This repository is an Open Core project.
- Core contributions should keep existing security guarantees: RBAC, ownership checks, validation, upload limits, and rate limits.

## How to contribute
1. Open an issue describing problem/context.
2. Fork and create a focused branch (one feature/fix per branch).
3. Implement in small, reviewable changes.
4. Add or update tests.
5. Run full quality gates before PR.
6. Open a PR with clear description, risks, and test results.

## Development standards
- Follow project conventions from `AGENT.md` and `docs/AGENTS.md`.
- Keep API behavior backward-compatible unless change is intentional and documented.
- Do not weaken auth/authorization checks.
- Avoid mixing unrelated refactors in one PR.

## Pull request checklist
- [ ] Scope is focused and justified.
- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] Lint and build pass.
- [ ] Manual smoke flow was checked.
- [ ] Documentation updated if behavior changed.

## Commit conventions
- `feat(scope): short summary`
- `fix(scope): short summary`
- `chore(scope): short summary`

## Security reporting
Do not open public issues for security vulnerabilities.
See `SECURITY.md` for coordinated disclosure instructions.
