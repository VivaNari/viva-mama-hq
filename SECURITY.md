# Security Policy

VivaMama handles sensitive maternal-health data. We take security and privacy
seriously and appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately via one of:

- **GitHub Security Advisories** — use *Security → Report a vulnerability* on this
  repository (preferred; lets us collaborate on a fix privately).
- **Email** — **security@nexaneura.com**. Encrypt sensitive details if possible.

Please include:

- A description of the issue and its impact
- Steps to reproduce (proof-of-concept if available)
- Affected component(s): `apps/mobile`, `services/backend`, `services/chatbot`,
  `packages/contracts`, or infrastructure/CI
- Any suggested remediation

### What to expect

| Stage | Target |
| --- | --- |
| Acknowledgement of your report | within **3 business days** |
| Initial assessment & severity | within **7 business days** |
| Fix / mitigation for confirmed high-severity issues | as quickly as feasible, coordinated with you |

We will keep you informed throughout and credit you in the release notes unless
you prefer to remain anonymous. Please give us reasonable time to remediate
before any public disclosure.

## Scope

In scope: source code in this repository and its build/CI configuration.

Out of scope: third-party services we integrate with (Groq, Razorpay, Twilio,
Firebase/GCP, MongoDB/Redis hosting) — report those to the respective vendors.

## Handling secrets & credentials

- **Never commit secrets.** Use the per-package `.env` files (templated by
  `.env.example`); they are git-ignored.
- CI runs **gitleaks** on every push and pull request to block secrets from
  entering history.
- Service-account keys are provided at runtime via
  `GOOGLE_APPLICATION_CREDENTIALS` (mounted), never baked into images or the repo.

### If a secret is exposed

A committed secret must be treated as **compromised even after removal from
history** — rotate it immediately at the provider, then purge it from git history
(e.g. `git filter-repo`) and force-push. Notify the maintainers so downstream
deployments can be rotated too.

## Supported versions

This project is pre-1.0; security fixes are applied to `main` and the latest
release. Pin a released version for production use and watch the repository for
advisories.
