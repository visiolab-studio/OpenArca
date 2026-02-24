# Security Policy (OpenArca)

## Supported versions
Security fixes are applied to the current active development line (`main`) and the latest public release candidate.

## Reporting a vulnerability
Please do not disclose vulnerabilities publicly.

Use one of the following channels:
1. GitHub Security Advisories (preferred).
2. Email: `hello@openarca.com` with subject prefix `[SECURITY][OpenArca]`.

## What to include
- Affected endpoint/module.
- Reproduction steps.
- Impact and expected vs actual behavior.
- Proof-of-concept (if available).
- Suggested mitigation (optional).

## Response targets
- Initial acknowledgment: up to 3 business days.
- Triage and severity assessment: up to 7 business days.
- Fix timeline depends on severity and reproducibility.

## Disclosure policy
- We follow coordinated disclosure.
- Public disclosure should happen after a fix is available or a mitigation path is agreed.
- If a report is out of scope or not reproducible, maintainers will still provide a short closure note.

## Security baseline (project-specific)
- RBAC and ownership checks for write endpoints.
- Input validation via schema validators.
- Upload type and size limits.
- Rate limiting for sensitive and write actions.
- No leakage of sensitive internals in API errors.
- OTP/JWT auth flows must preserve existing security guarantees.
