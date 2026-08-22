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

# `@86d-app/ui`

Shared merchant UI for 86d Console, Store Admin, and Modules. Primitives live under `shadcn/`, Console/Admin compositions under `console/`, and TanStack Table chrome under `data-table/`. There is no package-root barrel; import the file you need.

## Install

```sh
npm install @86d-app/ui
```

Peer dependencies: `react`, `react-dom`, `next`, `zod`, and `@tanstack/react-table@9.1.2`.

Import the token stylesheet once in the application CSS:

```css
@import "@86d-app/ui/globals.css";
```

## Data tables

Modules and Store Admin should use these controls rather than one-off table chrome:

```ts
import { DataTableColumnHeader } from "@86d-app/ui/data-table/column-header";
import { DataTableEmptyRow } from "@86d-app/ui/data-table/empty-row";
import { DataTableFacetedFilter } from "@86d-app/ui/data-table/faceted-filter";
import { DataTableResultCount } from "@86d-app/ui/data-table/result-count";
import { DataTableSkeletonRows } from "@86d-app/ui/data-table/skeleton-rows";
import { DataTableToolbar } from "@86d-app/ui/data-table/toolbar";
import { DataTableViewOptions } from "@86d-app/ui/data-table/view-options";
```

Other common paths:

| Export | Contents |
| --- | --- |
| `@86d-app/ui/button` | Button |
| `@86d-app/ui/shadcn/table` | Table primitives |
| `@86d-app/ui/shadcn/sheet` | Sheet |
| `@86d-app/ui/console/form-sheet` | Merchant form sheet |
| `@86d-app/ui/lib/utils` | `cn` |

`UserProvider` does not call a Control Plane or Store Runtime API. Pass `authority` and `isLoading` when a host needs `PermissionGate`.
