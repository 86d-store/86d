<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use.

# @86d-app/registry

Git-based module registry for the 86d commerce platform. Enables modules to be sourced from local workspace directories, GitHub repositories, or npm packages.

## Overview

The registry provides the module resolution layer for 86d stores. When a store's `config.json` lists modules, the registry determines where each module lives and how to fetch it.

**Key features:**
- Resolve modules and templates from local workspace, GitHub repos, or npm
- Generate and consume `registry.json` manifests with integrity verification
- Discover available modules with `"*"` without auto-enabling Experimental entries
- **Lock file** (`apps/registry/registry.lock.json`) for reproducible builds with `--frozen` CI support
- **Circular dependency detection** — throws on cycles with descriptive error messages
- Template resolution — fetch store templates from GitHub or npm
- Graceful handling of missing modules/templates with warnings
- Retry with exponential backoff for transient network failures

## Usage

### Module Specifiers

Modules can be referenced in `config.json` using several formats:

```json
{
  "modules": "*"
}
```

Or with explicit module references:

```json
{
  "modules": [
    "products",
    "@86d-app/cart",
    "github:owner/repo/modules/custom-module",
    "github:owner/repo/modules/loyalty#v2.0",
    "npm:@acme/commerce-module",
    "npm:@acme/commerce-module@^1.0.0"
  ],
  "advanced": {
    "version": 1,
    "allowExperimentalModules": true
  }
}
```

Use the `advanced` block only when every selected Experimental Module is intentional. The resolver treats entries without maturity evidence as Experimental.

| Format | Source | Description |
|---|---|---|
| `products` | local/registry | Official module by short name |
| `@86d-app/products` | local/registry | Official module by full package name |
| `github:owner/repo/path` | GitHub | Module from a GitHub repository subpath |
| `github:owner/repo/path#ref` | GitHub | GitHub module at a specific branch/tag |
| `npm:@scope/package` | npm | Module from npm registry |
| `npm:@scope/package@version` | npm | npm module with version constraint |

### Resolving Modules

```ts
import { resolveModules, readStoreConfig } from "@86d-app/registry";

const config = readStoreConfig("templates/brisa/config.json");
const resolved = await resolveModules(config, {
  root: "/path/to/project",
});

for (const mod of resolved) {
  console.log(mod.specifier.name, mod.status, mod.localPath);
}
```

### Building the Registry Manifest

```ts
import { buildManifest } from "@86d-app/registry";

const manifest = buildManifest("/path/to/project", {
  baseUrl: "https://github.com/86d-app/86d",
  defaultRef: "main",
});
// manifest.modules contains all discovered modules with metadata
```

### Fetching Remote Modules

```ts
import { fetchModule, parseSpecifier } from "@86d-app/registry";

const spec = parseSpecifier("github:owner/repo/modules/loyalty");
const result = await fetchModule(spec, "/path/to/project");

if (result.success) {
  console.log(`Installed to: ${result.localPath}`);
}
```

## CLI Integration

The registry integrates with the 86d CLI:

```sh
# Add a module from the registry (auto-installs required dependencies)
86d module add products

# Add from GitHub
86d module add github:owner/repo/modules/loyalty

# Add from npm
86d module add npm:@acme/commerce-module

# Check for module updates (compares local vs registry versions/integrity)
86d module update
86d module update cart

# Search the registry
86d module search shipping

# Generate registry manifest
86d generate registry
```

When adding a module, the CLI automatically resolves and installs any required dependencies (declared via the `requires` field in the registry manifest).

## Config Format

The store's `config.json` supports these registry-related fields:

| Field | Type | Default | Description |
|---|---|---|---|
| `modules` | `"*" \| string[]` | `"*"` | Explicit Module specifiers or wildcard discovery |
| `advanced` | `{ version: 1, allowExperimentalModules?: boolean }` | None | Versioned opt-in for explicitly named Experimental Modules |
| `template` | `string` | — | Template specifier (local name, GitHub, or npm) |
| `registry` | `string` | GitHub raw URL | Custom registry manifest URL |
| `moduleOptions` | `Record<string, object>` | `{}` | Per-module configuration |

### Module maturity and admission

The resolver applies maturity rules before code generation:

- Stable Modules resolve through ordinary explicit selection or wildcard discovery
- Experimental Modules must be named in `modules` and require `advanced.version: 1` with `allowExperimentalModules: true`
- Deprecated Modules return an error that directs you to their transition path
- Unknown names return a missing result with guidance to check the specifier or use a GitHub or npm source

An omitted `modules` field behaves like `"*"`. Neither form can enable Experimental Modules, even when the advanced flag is present.

### Resolving Templates

```ts
import { resolveTemplate, fetchTemplate } from "@86d-app/registry";

// Resolve from local, registry, GitHub, or npm
const result = resolveTemplate("brisa", "/path/to/project", manifest);

if (result.status === "missing") {
  const fetched = await fetchTemplate(result.specifier, "/path/to/project", manifest);
}
```

Template specifiers use the same formats as modules:
- `"brisa"` — local template in `templates/`
- `"github:owner/repo/templates/custom"` — from GitHub
- `"npm:@acme/store-template"` — from npm

## Registry Manifest

The `apps/registry/registry.json` file indexes all available modules and templates:

```json
{
  "version": 1,
  "baseUrl": "https://github.com/86d-app/86d",
  "defaultRef": "main",
  "modules": {
    "products": {
      "name": "@86d-app/products",
      "description": "Product catalog management",
      "version": "0.0.4",
      "category": "catalog",
      "path": "modules/products",
      "requires": [],
      "hasStoreComponents": true,
      "hasAdminComponents": true,
      "hasStorePages": true,
      "integrity": "sha256-..."
    }
  },
  "templates": {
    "brisa": {
      "name": "brisa",
      "description": "86d Starter Kit",
      "version": "0.0.1",
      "path": "templates/brisa"
    }
  }
}
```

Generate it with:

```sh
bun run generate:registry
```

## API Reference

### `parseSpecifier(raw: string): ModuleSpecifier`
Parse a module specifier string into a structured object with source type, name, and metadata.

### `resolveModules(config, options): Promise<ResolvedModule[]>`
Resolve a store config's module list into concrete entries with status (`found`, `missing`, `error`).

### `evaluateModuleAdmission(input): ModuleAdmissionDecision`
Apply selection and maturity rules to one resolved or generated Module. Import it from `@86d-app/registry/admission` when a runtime needs the same fail-closed decision as the resolver.

### `fetchModule(spec, root, manifest?): Promise<FetchResult>`
Download a module from its remote source (GitHub tarball or npm) and install it locally.

### `buildManifest(root, options?): RegistryManifest`
Scan the `modules/` directory and build a registry manifest with full metadata for each module.

### `readStoreConfig(path): StoreConfig`
Read and parse a store's `config.json` file.

### `getModuleDependencies(name, manifest): string[]`
Get the full transitive dependency list for a module, topologically sorted (dependencies before dependents). Throws if a circular dependency is detected.

### `detectCircularDependencies(manifest): string[]`
Scan all modules in a manifest for circular dependencies. Returns an array of cycle descriptions (e.g., `"a → b → c → a"`). Returns empty array if no cycles exist.

### `generateLockfile(resolved, root): Lockfile`
Generate a lock file from resolved modules, capturing source, version, integrity hash, and location.

### `writeLockfile(root, lockfile): void`
Write the lock file to `apps/registry/registry.lock.json`.

### `readLockfile(root): Lockfile | undefined`
Read the lock file from the project root. Returns undefined if not found or invalid.

### `verifyLockfile(lockfile, resolved): LockfileDiff`
Compare a lock file against current resolved modules. Returns `{ added, removed, changed }`.

### `isLockfileSatisfied(diff): boolean`
Returns true if the diff has no added, removed, or changed modules.

### `getLocalModuleNames(root): string[]`
Get sorted list of all locally available module names.

### `resolveTemplate(spec, root, manifest?): ResolvedTemplate`
Resolve a template specifier to a local directory, checking local templates first then registry.

### `fetchTemplate(spec, root, manifest?): Promise<FetchResult>`
Download a template from GitHub or npm and install it into `templates/`.

### `getLocalTemplateNames(root): string[]`
Get sorted list of all locally available template names.

### `readTemplateConfig(path): Record<string, unknown> | undefined`
Read a template's `config.json` contents.

### `computeIntegrity(modulePath): string | undefined`
Compute SHA-256 integrity hash for a module's `package.json`.

## Buildtime Integration

The registry is used at buildtime by `internals/generators/src/generate-modules.ts`:

1. Reads `config.json` and resolves all module specifiers
2. For missing modules (registry/GitHub/npm), fetches them automatically
3. Generates the store's import files in `apps/store/generated/`

This means `bun run generate:modules` pulls missing admitted Modules before generating code. Modules that fail resolution, admission, or fetching are skipped with warnings.

## Lock File

The `apps/registry/registry.lock.json` file captures the exact resolved state of all modules for reproducible builds. It is generated automatically by `bun run generate:modules`.

```json
{
  "lockfileVersion": 1,
  "generatedAt": "2026-03-12T18:00:00.000Z",
  "modules": {
    "products": {
      "source": "local",
      "packageName": "@86d-app/products",
      "version": "0.0.4",
      "integrity": "sha256-...",
      "localPath": "modules/products"
    }
  }
}
```

### Frozen Installs (CI)

Use `--frozen` to fail if the lock file is outdated:

```sh
bun run generate:modules -- --frozen
```

This ensures CI builds use the exact same module resolution as the developer who last generated the lock file.

## Circular Dependency Detection

The registry detects circular dependencies in the module dependency graph and throws descriptive errors:

```
Circular dependency detected: cart → checkout → orders → cart
```

This runs automatically during `generate:modules` and will fail the build if cycles are found.

## Notes

- When `modules` is `"*"` or omitted, all local workspace modules are included
- GitHub fetching uses the tarball API; `tar` must be available on the system
- Set `GITHUB_TOKEN` environment variable for private repos or to avoid rate limits
- npm modules are installed to `node_modules/` via `bun add` (falls back to `npm install`)
- The resolver always checks local workspace first before attempting remote sources
