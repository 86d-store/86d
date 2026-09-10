## Summary

<!-- What problem does this solve, and why this approach? -->

## Checklist

- [ ] `bun run generate:modules -- --frozen`
- [ ] `bun run typecheck`
- [ ] `bun run check`
- [ ] `bun run test`
- [ ] `bun run docker:build`
- [ ] `bun run docker:verify`
- [ ] Commits use [Conventional Commits](https://www.conventionalcommits.org/) with a **required scope** (`type(scope): subject`)
- [ ] Tests updated for behavior changes (Vitest by default; Playwright for browser-only seams)
- [ ] Changeset added when a published package or Module API changes (`bunx changeset`)
- [ ] Security-relevant changes follow [SECURITY.md](../SECURITY.md) (no public exploit detail)

Same-repository Module and lockfile pull requests trigger automated lock sync in CI. Fork pull requests are never mutated; open the workflow run summary for exact local rebase and lockfile-refresh commands. For same-repository branches, manual `bun run regen:locks` is needed only when the workflow comments about unresolved non-lock conflicts.

Agents never push. Leave remote publication to a human operator.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full guide.
