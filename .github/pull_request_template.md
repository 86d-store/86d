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
- [ ] Tests updated for behavior changes (Vitest; Playwright where UI is affected)
- [ ] Changeset added when a published package or Module API changes (`bunx changeset`)
- [ ] Security-relevant changes follow [SECURITY.md](../SECURITY.md) (no public exploit detail)

Agents never push. Leave remote publication to a human operator.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full guide.
