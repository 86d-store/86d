# CLI

Command-line interface for the Store Runtime, published as `86d`.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file.
2. **Implement** using the local patterns below.
3. **Verify.** `bun run test` in this package (or `vitest run`). Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_.

## Structure

```
src/
  index.ts              Entry point — arg parsing, command dispatch, help/version
  utils.ts              findProjectRoot, getVersion, ANSI colors, parseEnvFile, readJson
  commands/
    dev.ts              Start store dev server (spawns Next.js)
    init.ts             Configure local store (env, deps, codegen, optional migrate+seed)
    status.ts           Show project health and configuration
    doctor.ts           Diagnose issues with fix suggestions
    module.ts           Module subcommands (build, create, list, info, enable, disable)
    module-build.ts     Compile TypeScript and copy non-TS assets into dist/
    template.ts         Template subcommands (create, list, activate)
    generate.ts         Code generation (module imports, API router, component docs)
  __tests__/
    *.test.ts           Vitest test files
```

## Commands

| Command | Description |
|---|---|
| `86d dev [--port N]` | Start the store dev server |
| `86d init [--yes\|-y]` | Configure a local store (env, deps, migrate, seed) |
| `86d status` | Show project health and configuration |
| `86d doctor` | Diagnose project issues with fix suggestions |
| `86d module build [dir]` | Compile TypeScript and copy non-TS assets |
| `86d module create <name>` | Scaffold a new module |
| `86d module list` | List all modules |
| `86d module info <name>` | Show module details |
| `86d module enable <name>` | Enable a module in the active template |
| `86d module disable <name>` | Disable a module in the active template |
| `86d template create <name>` | Scaffold a new template from brisa |
| `86d template list` | List all templates |
| `86d template activate <name>` | Switch the store to use a template |
| `86d generate [modules\|components]` | Run code generation |

Use `package.json` and `--help` as the live command inventory.

## Utilities (`utils.ts`)

- `findProjectRoot()` — walks up from cwd for `turbo.json` plus `package.json` name `"86d"`
- `getVersion()` — CLI or root `package.json` version
- `c` — zero-dep ANSI helpers (bold, dim, green, yellow, blue, cyan, red, gray)
- `parseEnvFile(path)` — `.env` → `Record<string, string>`
- `readJson<T>(path)` — safe JSON read; `undefined` on failure
- `detectActiveTemplate(root)` — active template from store tsconfig
- `getTemplateConfigPath(root)` — active template `config.json` path

## Gotchas

- Workspace `bin` is `bin/86d.mjs` (must exist at install time). `publishConfig.bin` is `dist/index.js`. A gitignored build output cannot be the workspace bin target.
- No external CLI framework — raw `process.argv` parsing
- `findProjectRoot` requires both `turbo.json` and `package.json` with name `"86d"`
- `init --yes` / `-y`: skips interactive Y/N prompts; auto-confirms migrate + seed
- `init` with reachable `DATABASE_URL`: prompts migrate then seed (prints admin credentials on success)
- `init` in non-TTY (CI, pipes): skips DB setup automatically
