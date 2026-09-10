<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
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
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk. 

📚 **Documentation:** [86d.app/docs/concepts/storefront](https://86d.app/docs/concepts/storefront)

# Store Application

The customer-facing storefront application built with Next.js and MDX.

## Quick Start

```bash
# First time setup
bun run prepare

# Development
bun run dev

# Production build
bun run build
bun run start
```

## Project Structure

```
apps/store/
├── app/                      # Next.js app directory
├── scripts/
│   └── generate-modules.ts   # Module generator script
├── templates/brisa/
│   └── config.json           # Store configuration & module list
├── mdx-components.tsx        # MDX component registry
├── modules.ts                # Auto-generated module imports (DO NOT EDIT)
└── next.config.ts            # Next.js configuration
```

## Configuration

All store configuration is in `templates/brisa/config.json`:

```json
{
    "name": "My Store",
    "theme": "brisa",
    "modules": [
        "@86d-app/cart",
        "@86d-app/products"
    ],
    "advanced": {
        "version": 1,
        "allowExperimentalModules": true
    },
    "variables": {
        "light": { ... },
        "dark": { ... }
    }
}
```

The advanced block admits only Experimental Modules that you explicitly name. A wildcard or omitted `modules` field cannot admit them.

## Module System

This app uses a dynamic module system. Modules are listed in `config.json` and automatically loaded.

### Adding a Module

1. Add to `config.json`:
   ```json
   {
       "modules": [
           "@86d-app/cart",
           "@86d-app/your-module"
       ]
   }
   ```

2. Run prepare:
   ```bash
   bun run prepare
   ```

The script will:
- Add the module to `package.json` if needed
- Install dependencies
- Generate `modules.ts` with static imports

### Module Types

- **Workspace**: `@86d-app/*` modules from `/modules` directory
- **NPM**: Any other module name (installed from npm)

Both types are treated the same way and can export components for use in MDX.

## Scripts

- `bun run generate:modules` - Initialize/regenerate module imports from repo root
- `bun run dev` - Start dev server
- `bun run build` - Build for production (runs codegen with `--frozen` first)

## MDX Components

Components from modules are automatically registered and available in MDX files:

```mdx
# My Page

<Cart />

<ProductGrid />
```

The module generator merges all components from enabled modules into the MDX component registry.

## Development Workflow

1. Edit `templates/brisa/config.json` to enable/disable modules
2. Run `bun run dev` (automatically runs prepare → generates modules)
3. Components from modules are available in MDX
4. Edit MDX files in `templates/brisa/` directory

## See Also

- [Module System Documentation](/MODULES.md) - Complete guide to creating and using modules
- [Framework Documentation](/README.md) - Overall framework architecture

## UI composition

The application uses `@86d-app/ui` primitives and compositions. Keep their behavior in the shared package. App-level actions use `components/store-action.tsx` for consistent touch targets, focus, and reduced-motion behavior; links remain semantic links.

Presentation and behavior have separate owners:

| Surface | Behavior and prepared data | Presentation |
| --- | --- | --- |
| Admin navigation | `components/admin/shell.tsx`, its `_hooks/`, and `lib/admin-navigation.ts` | `components/admin/shell.mdx` |
| Dashboard | `app/admin/_hooks/` | `app/admin/_components/dashboard*.mdx` |
| Customer account | `app/(insecure)/account/_hooks/` and `_components/*.tsx` | Co-located account MDX files |
| Errors and missing pages | Each route supplies its recovery action | `components/page-state.mdx` |
| Storefront | `components/store-navbar.tsx` and Brisa footer controller | [Brisa template](../../templates/brisa/README.md) |

MDX receives prepared values and callbacks. Query validation, currency/date formatting, persistence, routing decisions, and mutations stay in TypeScript. Shared layouts should compose the existing primitives before adding another wrapper. Route loading files reuse the same presentation parts as the loaded screen.

The guarded `/__merchant_ui_fixtures__/store-ui` route supports dashboard loaded, empty, loading, error, permission, and unavailable states, plus `surface=navbar`, `surface=account`, and `surface=recovery`. It requires `BROWSER_MERCHANT_UI_FIXTURES=true`; it is a visual development fixture, not an authenticated commerce test. Verification and limitations are recorded in the [UI rewrite evidence](../../internals/docs/store-ui-rewrite.md).
