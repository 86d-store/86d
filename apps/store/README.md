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
