# CLI

Command-line interface for the 86d platform, published as `86d`.

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
    module.ts           Module subcommands (create, list, info, enable, disable)
    template.ts         Template subcommands (create, list, activate)
    generate.ts         Code generation (module imports, API router, component docs)
  __tests__/
    *.test.ts           Vitest test files (9 test files, 69+ tests)
```

## Commands

| Command | Description |
|---|---|
| `86d dev [--port N]` | Start the store dev server |
| `86d init [--yes\|-y]` | Configure a local store (env, deps, migrate, seed) |
| `86d status` | Show project health and configuration |
| `86d doctor` | Diagnose project issues with fix suggestions |
| `86d module create <name>` | Scaffold a new module |
| `86d module list` | List all modules |
| `86d module info <name>` | Show module details |
| `86d module enable <name>` | Enable a module in the active template |
| `86d module disable <name>` | Disable a module in the active template |
| `86d template create <name>` | Scaffold a new template from brisa |
| `86d template list` | List all templates |
| `86d template activate <name>` | Switch the store to use a template |
| `86d generate [modules\|components]` | Run code generation |

## Key utilities (utils.ts)

- `findProjectRoot()` — walks up from cwd looking for `turbo.json` with `package.json` name `"86d"`
- `getVersion()` — reads version from CLI or root `package.json`
- `c` — zero-dep ANSI color helpers (bold, dim, green, yellow, blue, cyan, red, gray)
- `parseEnvFile(path)` — parses `.env` files into `Record<string, string>`
- `readJson<T>(path)` — safe JSON file reader, returns `undefined` on failure
- `detectActiveTemplate(root)` — reads store tsconfig to find active template name
- `getTemplateConfigPath(root)` — resolves active template's `config.json` path

## Gotchas

- Binary is `86d` (from `package.json` `bin` field), built to `dist/index.js`
- No external CLI framework — uses raw `process.argv` parsing
- `findProjectRoot` requires both `turbo.json` and `package.json` with name `"86d"`
- Tests use Vitest — run with `bun run test` or `vitest run`
- `init --yes` / `-y`: skips all interactive Y/N prompts, auto-confirms migrate + seed
- `init` with a reachable DATABASE_URL: prompts to run migrations then seed (prints admin credentials on success)
- `init` in non-TTY (CI, pipes): skips DB setup automatically since stdin is not interactive
