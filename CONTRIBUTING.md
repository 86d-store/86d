# Contributing to 86d

Thank you for your interest in improving 86d. The codebase is shaped for small, focused changes. We review those pull requests first.

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- [Bun](https://bun.sh) v1.4.0+
- [Node.js](https://nodejs.org) 23, 24, or 25
- [PostgreSQL](https://www.postgresql.org) v15+
- [Docker](https://docs.docker.com/get-docker/) with Buildx, plus Compose support for ephemeral published ports and `up --wait` / `--wait-timeout`

## Setup

```bash
git clone https://github.com/86d-store/86d
cd 86d
bun install
bun run 86d init
```

Run `86d doctor` to verify the project is healthy before you make changes.

## Development loop

Six health gates must pass before a pull request can merge (CI `ci/cd` job, after commitlint):

```bash
bun run generate:modules -- --frozen # Generated registry integrity
bun run typecheck                      # TypeScript
bun run check                          # Biome lint + format
bun run test                           # Vitest unit tests
bun run docker:build                   # Production Store Runtime image
bun run docker:verify                  # Container boot and health smoke
```

Run them locally in that order and fix everything they flag. The Docker build and smoke gates are the production Store Runtime proof. `bun run build` remains available for package and Module authoring, and Release builds publishable packages before npm publication. The same `ci/cd` job also runs on pushes to `main` (commitlint first) and must pass before Release. Focused Playwright browser smoke (`bun run test:browser`) uses its own production Store build in a path-filtered pull-request and `main` workflow; it does not block publish.

## Commit messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org/) with a **required scope**. Git hooks enforce the format on every commit.

```
type(scope): subject
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes:** `store`, `cli`, `core`, `runtime`, `sdk`, `registry`, `db`, `emails`, `env`, `lib`, `storage`, `ui`, `utils`, `modules`, `ci`, `deps`, `config`, `docs`, `repo`

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

Hooks install automatically on `bun install`. If a hook fails, fix the cause and commit again.

## Lockfile conflicts

Two committed lockfiles can conflict when multiple pull requests regenerate them:

- `apps/registry/registry.lock.json` — module integrity lock from `bun run generate:modules`
- `bun.lock` — dependency lock from `bun install`

Both stay in git. Never gitignore them.

### One-time setup after clone

```bash
sh internals/scripts/configure-git-merge-drivers.sh
```

This registers git merge drivers that regenerate each lockfile during merges and rebases instead of leaving conflict markers.

### Refresh both lockfiles

```bash
bun run regen:locks
```

### Pull request automation

Pull requests that touch `modules/`, `packages/registry/`, or either lockfile run the **Sync PR lockfiles** workflow.

- **Same-repository branches:** the workflow rebases onto the base branch, regenerates lockfiles, and force-pushes when the branch is behind.
- **Fork pull requests:** the workflow does not mutate the branch or PR. Open the workflow run summary for exact local rebase and lockfile-refresh commands.

If the workflow comments that a same-repository branch has non-lock conflicts, resolve those locally, then run `bun run regen:locks` and push.

## Pull requests

- **One coherent change per PR.** A bug fix, a new endpoint, a new module, a docs improvement. Not all four at once.
- **Tests for every code change.** New endpoint -> add Vitest tests. UI change -> add rendered-state coverage and visually inspect it. Add Playwright coverage only for a browser-specific seam. Bug fix -> add a regression test.
- **A real description.** What problem the PR solves, why this approach, what alternatives you considered, what is not yet covered.
- **Changesets entry.** For changes that affect a published package, run `bunx changeset` and commit the generated file. Release uses Changesets to decide whether package and container publication can proceed.

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
bun test --filter @86d-store/my-feature
```

Before requesting review:

- Real schema with proper types and relations
- Storefront and admin endpoints, fully implemented (no `TODO` bodies)
- Loading, error, and empty states in any UI components
- Vitest tests for critical paths with realistic fixtures
- For external API integrations: real HTTP calls, retries, error mapping, webhook signature verification
- Rendered-state tests for new admin or storefront states, plus visual inspection in Chrome at 1280×720 and 375×667 in light and dark. Check required states, focus, overflow, errors, and recovery. Screenshots are review artifacts, not pixel baselines or launch evidence.

## Publishing external Modules

You do not need to upstream a Module to publish it:

1. Build with `bun run build` so `dist/` contains JavaScript and `.d.ts` (and any `.mdx` assets your components import). Module packages use `"build": "86d module build"`, which removes the Module's previous `dist/` before compiling and copying current assets.
2. Set `"private": false` and a release version in `package.json`.
3. Ship only `dist` (+ README) via `"files"`; put consumer entry points in `publishConfig.exports` under `./dist`. Do not publish `src`, tests, `.turbo`, or vitest config.
4. Replace `workspace:*` / `catalog:` dependency specs with real semver versions.
5. Add accurate package metadata and provenance.
6. Publish: `npm publish --access public`.

## Documentation

Docs live in [86d-store/docs](https://github.com/86d-store/docs). See that repository's `CONTRIBUTING.md` for docs-specific guidelines.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

## Getting help

- [Discussions](https://github.com/86d-store/86d/discussions) for help questions and feature ideas
- [Issues](https://github.com/86d-store/86d/issues) for reproducible bugs (and in-repo docs problems)
- [SECURITY.md](SECURITY.md) for vulnerabilities — never open a public issue for those
