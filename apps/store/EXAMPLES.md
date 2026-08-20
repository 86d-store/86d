# Module System Examples

## Example 1: Using a Workspace Module

You already have `@86d-app/cart` working as a workspace module.

**Config** (`templates/brisa/config.json`):
```json
{
    "modules": ["@86d-app/cart"]
}
```

**Generated** (`modules.ts`):
```typescript
import moduleComponents0 from "@86d-app/cart/components";

export const modules = ["@86d-app/cart"] as const;

const components: MDXComponents = {
    ...moduleComponents0,
};
```

**Usage** (in MDX):
```mdx
<Cart />
```

---

## Example 2: Adding a New Workspace Module

Create a products module:

```bash
# From workspace root
bun run create:module products
```

This creates:
```
modules/products/
├── package.json          # @86d-app/products
├── src/
│   └── store/
│       └── components/   # ProductCard, ProductGrid components
└── tsconfig.json
```

**Update config** (`templates/brisa/config.json`):
```json
{
    "modules": [
        "@86d-app/cart",
        "@86d-app/products"
    ]
}
```

**Add to store dependencies** (`apps/store/package.json`):
```json
{
    "dependencies": {
        "@86d-app/products": "workspace:*"
    }
}
```

**Generate**:
```bash
cd apps/store
bun run prepare
```

**Result** - Both modules available:
```mdx
<Cart />
<ProductGrid />
<ProductCard id="123" />
```

---

## Example 3: Using External NPM Modules

Add third-party modules from npm:

**Config** (`templates/brisa/config.json`):
```json
{
    "modules": [
        "@86d-app/cart",
        "@some-company/analytics-widget",
        "react-product-carousel"
    ]
}
```

**Run**:
```bash
cd apps/store
bun run generate:modules
```

The script will:
1. Detect `@86d-app/cart` is workspace → use `workspace:*`
2. Detect `@some-company/analytics-widget` is npm → add as `latest`
3. Detect `react-product-carousel` is npm → add as `latest`
4. Update `package.json`:
   ```json
   {
       "dependencies": {
           "@86d-app/cart": "workspace:*",
           "@some-company/analytics-widget": "latest",
           "react-product-carousel": "latest"
       }
   }
   ```
5. Run `bun install`
6. Generate `modules.ts` with imports from all three

---

## Example 4: Module Without Components

Some modules might only provide hooks or API routes:

**Config**:
```json
{
    "modules": [
        "@86d-app/cart",
        "@86d-app/analytics"
    ]
}
```

If `@86d-app/analytics` has no `src/store/components/index.tsx` or it's empty:

**Generated**:
```typescript
import moduleComponents0 from "@86d-app/cart/components";
// analytics skipped - no components

export const modules = [
    "@86d-app/cart",
    "@86d-app/analytics"  // still in module list for hooks/routes
] as const;

const components: MDXComponents = {
    ...moduleComponents0,  // only cart components
};
```

The module is still tracked but doesn't add MDX components.

---

## Example 5: Conditional Modules

Enable/disable features by editing config:

**Development Config**:
```json
{
    "modules": [
        "@86d-app/cart",
        "@86d-app/products",
        "@86d-app/debug-tools"
    ]
}
```

**Production Config**:
```json
{
    "modules": [
        "@86d-app/cart",
        "@86d-app/products"
    ]
}
```

The build process automatically includes only the modules in config at build time.

---

## Example 6: Full E-commerce Setup

**Config**:
```json
{
    "modules": [
        "@86d-app/cart",
        "@86d-app/products",
        "@86d-app/collections",
        "@86d-app/checkout",
        "@86d-app/customers",
        "@86d-app/orders",
        "@86d-app/blog",
        "@86d-app/newsletter",
        "@86d-app/reviews",
        "@stripe/stripe-components"
    ]
}
```

**Generated modules.ts**:
```typescript
import moduleComponents0 from "@86d-app/cart/components";
import moduleComponents1 from "@86d-app/products/components";
import moduleComponents2 from "@86d-app/collections/components";
import moduleComponents3 from "@86d-app/checkout/components";
import moduleComponents4 from "@86d-app/customers/components";
import moduleComponents5 from "@86d-app/orders/components";
import moduleComponents6 from "@86d-app/blog/components";
import moduleComponents7 from "@86d-app/newsletter/components";
import moduleComponents8 from "@86d-app/reviews/components";
import moduleComponents9 from "@stripe/stripe-components/components";

export const modules = [
    "@86d-app/cart",
    "@86d-app/products",
    "@86d-app/collections",
    "@86d-app/checkout",
    "@86d-app/customers",
    "@86d-app/orders",
    "@86d-app/blog",
    "@86d-app/newsletter",
    "@86d-app/reviews",
    "@stripe/stripe-components"
] as const;

const components: MDXComponents = {
    ...moduleComponents0,
    ...moduleComponents1,
    ...moduleComponents2,
    ...moduleComponents3,
    ...moduleComponents4,
    ...moduleComponents5,
    ...moduleComponents6,
    ...moduleComponents7,
    ...moduleComponents8,
    ...moduleComponents9,
};
```

**Usage in MDX**:
```mdx
# Product Page

<ProductGrid collection="featured" />

<Newsletter />

<Reviews productId="123" />

<AddToCart productId="123" />
```

---

## Workflow Summary

### Initial Setup
```bash
cd apps/store
bun run generate:modules
```

### Add a Module
1. Edit `templates/brisa/config.json` → add module name
2. Run `bun run generate:modules` → installs missing modules (if needed) and regenerates files
3. Use components in MDX

### Remove a Module
1. Edit `templates/brisa/config.json` → remove module name
2. Run `bun run generate:modules` → regenerates without that module
3. Optionally remove from `package.json` manually

### Development
```bash
bun run dev  # Run codegen first if config changed
```

### Production
```bash
bun run build  # Runs codegen with --frozen before build
```

---

## Tips

1. **Version Control**: Commit `modules.ts` to git so team members see what's loaded
2. **Dependencies**: The script manages `package.json` but you can manually update versions
3. **Type Safety**: Generated file uses `as const` for type-safe module lists
4. **Empty Modules**: Modules without components are tracked but don't add to MDX registry
5. **Hot Reload**: Changes to `config.json` require running `bun run generate:modules` or restarting dev server
