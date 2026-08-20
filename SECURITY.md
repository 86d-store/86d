# Security policy

## Reporting a vulnerability

Report security issues privately through either channel:

- [GitHub Security Advisories](https://github.com/86d-app/86d/security/advisories)
- Email: [security@86d.store](mailto:security@86d.store)

Do **not** open a public GitHub issue, pull request, or discussion for a security-relevant report. Keep secrets, personal data, and working exploit detail out of public channels.

Include as much of the following as you can:

- Affected component (Store Runtime, Module, CLI, package, or docs)
- Version, commit, or deployment shape where you saw the issue
- Steps to reproduce, or a minimal proof of concept
- Impact (what an attacker could read, change, or disrupt)
- Any mitigations you already tried

We triage private reports as they arrive. If the report is urgent, say so in the first sentence.

## What counts as a security issue

In scope examples:

- Authentication or session bypass
- Authorization failures (cross-customer or cross-Store access)
- Unauthenticated or unsigned provider webhook acceptance
- Secret or credential exposure in logs, clients, generated config, or source
- Injection, XSS, or path traversal that reaches production data or admin surfaces
- Unsafe file upload handling

Out of scope for this policy (use ordinary channels instead):

- Setup failures, missing env vars, and local misconfiguration → [Issues](https://github.com/86d-app/86d/issues) or [Troubleshooting](https://86d.app/docs/operations/troubleshooting)
- Feature requests and design questions → [Discussions](https://github.com/86d-app/86d/discussions)
- Dependency advisories with no practical impact on this repository (we still welcome a private note if you are unsure)

## Supported versions

This project is under active development and is not production-ready. Security fixes land on the default branch. Prefer the latest `main` commit when verifying a report.

## Hardening guidance

Operational boundaries for a self-hosted Store Runtime (auth secrets, uploads, provider events, Store isolation) are documented in [Secure a Store Runtime](https://86d.app/docs/operations/security).
