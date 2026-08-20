# Contributing to 86d

Thank you for your interest in improving 86d. The codebase is shaped for small, focused changes. We review those pull requests first.

## Prerequisites

- [Bun](https://bun.sh) v1.3.14+
- [Node.js](https://nodejs.org) 23, 24, or 25
- [PostgreSQL](https://www.postgresql.org) v15+

## Setup

```bash
git clone https://github.com/86d-app/86d
cd 86d
bun install
bun run 86d init
```

Run `86d doctor` to verify the project is healthy before you make changes.

## Development loop

Four health gates must pass before a pull request can merge (CI `ci/cd` job, in this order):

```bash
bun run check       # Biome lint + format
bun run typecheck   # TypeScript
bun run test        # Vitest unit tests
bun run build       # Production build
```

Run them locally and fix everything they flag. Playwright E2E (`bun run test:e2e`) runs in CI only on `main`, not on pull requests.

## Commit messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org/) with a **required scope**. Git hooks enforce the format on every commit.

```
type(scope): subject
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes:** `store`, `cli`, `core`, `runtime`, `sdk`, `registry`, `db`, `emails`, `env`, `lib`, `storage`, `utils`, `modules`, `ci`, `deps`, `config`, `docs`, `repo`

**Examples:**

```
feat(store): add checkout finalization step
fix(modules): handle empty cart in stripe webhook
chore(deps): bump turbo to 2.10.9
docs(contributing): document commit message rules
```

Rules:

- Use imperative, lowercase subject (no trailing period)
- Keep the subject under 72 characters when possible (100 max)
- One logical change per commit

Hooks install automatically on `bun install`. To bypass hooks in an emergency, use `git commit --no-verify` (CI will still enforce the format on pull requests).

## Pull requests

- **One coherent change per PR.** A bug fix, a new endpoint, a new module, a docs improvement. Not all four at once.
- **Tests for every code change.** New endpoint -> add Vitest tests. UI change -> update Playwright snapshots. Bug fix -> add a regression test.
- **A real description.** What problem the PR solves, why this approach, what alternatives you considered, what is not yet covered.
- **Changesets entry.** For changes that affect a published package, run `bunx changeset` and commit the generated file. CI will reject PRs without one when one is needed.

## Coding standards

- **No `any`, `@ts-expect-error`, `@ts-ignore`, or `biome-ignore`.** Fix the underlying type or code.
- **No edits to `tsconfig.json`, `biome.json`, or other config files to silence errors.** If a rule does not fit, raise it; do not bypass it.
- **Do not modify primitive UI libraries.** Wrap or compose shadcn/ui, Base UI, Radix UI, and React Aria. Do not edit their internals.
- **Never delete or weaken a passing test** to make a new change pass.
- **Biome handles formatting.** `bun run check:fix` to auto-fix.

See `AGENTS.md` for architecture, module conventions, and detailed coding guidance.

## Writing a Module

```bash
bun run 86d module create my-feature
bun run 86d module enable my-feature
bun run generate:modules
bun test --filter @86d-app/my-feature
```

Before requesting review:

- Real schema with proper types and relations
- Storefront and admin endpoints, fully implemented (no `TODO` bodies)
- Loading, error, and empty states in any UI components
- Vitest tests for critical paths with realistic fixtures
- For external API integrations: real HTTP calls, retries, error mapping, webhook signature verification
- Playwright visual snapshots for any new admin or storefront screen, in light + dark mode, desktop + mobile

## Publishing external Modules

You do not need to upstream a Module to publish it:

1. Build with `bun run build`.
2. Set `"private": false` and a release version in `package.json`.
3. Add accurate package metadata and provenance.
4. Publish: `npm publish --access public`.

## Documentation

Docs live in [86d-app/docs](https://github.com/86d-app/docs). See that repository's `CONTRIBUTING.md` for docs-specific guidelines.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

## Getting help

- [Discussions](https://github.com/86d-app/86d/discussions) for design proposals and open questions
- [Issues](https://github.com/86d-app/86d/issues) for bugs and feature requests
