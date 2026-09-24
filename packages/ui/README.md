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

# `@86d-store/ui`

Shared merchant UI for 86d Console, Store Admin, and Modules. Primitives live under `shadcn/`, Console/Admin compositions under `console/`, and TanStack Table chrome under `data-table/`. There is no package-root barrel; import the file you need.

## Install

```sh
npm install @86d-store/ui
```

Peer dependencies: `react`, `react-dom`, `next`, `zod`, and `@tanstack/react-table@9.2.4`.

Import the shared stylesheet once in the application CSS:

```css
@import "@86d-store/ui/globals.css";
```

This entry point includes Tailwind, the shared fonts, typography, color tokens, motion utilities, and base component styles. Application stylesheets keep their source scanning and application-specific rules; they do not redefine the shared defaults.

Fonts are self-hosted through this package's Fontsource dependencies: Zalando Sans for body and display text, Zalando Sans SemiExpanded Variable for headings, Merriweather for serif text, and IBM Plex Mono for code. Use `font-sans`, `font-display`, `font-heading`, `font-serif`, and `font-mono`; a separate font import in the application layout is unnecessary.

Primary, secondary, constructive, caution, destructive, and neutral each expose steps `25`, `50`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`, `950`, and `1000`. Secondary follows the neutral ramp. The raw `--primary-100` palette values remain fixed, while `--primary-step-100` and Tailwind utilities such as `bg-primary-100` follow the active appearance. Dark mode reverses the steps (`25` ↔ `1000`, `50` ↔ `950`, …, `500` stays fixed), so semantic classes work in either mode.

Existing color values, semantic assignments, fixed chart colors, and explicit dark overrides preserve the UI specification. Backgrounds, borders, code, and selection reference the shared ramps. Status styling uses the canonical families directly, such as `bg-constructive-50 text-constructive-600`, `bg-caution-50 text-caution-600`, and `bg-destructive-50 text-destructive-600`.

## Data tables

Modules and Store Admin should use these controls rather than one-off table chrome:

```ts
import { DataTableColumnHeader } from "@86d-store/ui/data-table/column-header";
import { DataTableEmptyRow } from "@86d-store/ui/data-table/empty-row";
import { DataTableFacetedFilter } from "@86d-store/ui/data-table/faceted-filter";
import { DataTableResultCount } from "@86d-store/ui/data-table/result-count";
import { DataTableSkeletonRows } from "@86d-store/ui/data-table/skeleton-rows";
import { DataTableToolbar } from "@86d-store/ui/data-table/toolbar";
import { DataTableViewOptions } from "@86d-store/ui/data-table/view-options";
```

Other common paths:

| Export | Contents |
| --- | --- |
| `@86d-store/ui/button` | Button |
| `@86d-store/ui/shadcn/table` | Table primitives |
| `@86d-store/ui/shadcn/sheet` | Sheet |
| `@86d-store/ui/console/form-sheet` | Merchant form sheet |
| `@86d-store/ui/lib/utils` | `cn` |

`UserProvider` does not call a Control Plane or Store Runtime API. Pass `authority` and `isLoading` when a host needs `PermissionGate`.
