# Import/Export Module

Manages bulk data import and export jobs for products, customers, orders, and inventory.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-app/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts          Factory: importExport(options?) => Module
  schema.ts         Zod models: importJob, exportJob
  service.ts        ImportExportController interface + types
  service-impl.ts   ImportExportController implementation
  store/
    endpoints/      Empty — no store-facing endpoints
  admin/
    components/
      import-export-overview.*   Overview MDX + TSX
      import-detail.*            Import detail MDX + TSX
    endpoints/
      list-imports.ts                GET  /admin/import-export/imports
      create-import.ts               POST /admin/import-export/imports/create
      get-import.ts                  GET  /admin/import-export/imports/:id
      update-import-status.ts        POST /admin/import-export/imports/:id/status
      process-import-row.ts          POST /admin/import-export/imports/:id/process-row
      complete-import.ts             POST /admin/import-export/imports/:id/complete
      cancel-import.ts               POST /admin/import-export/imports/:id/cancel
      delete-import.ts               POST /admin/import-export/imports/:id/delete
      list-exports.ts                GET  /admin/import-export/exports
      create-export.ts               POST /admin/import-export/exports/create
      get-export.ts                  GET  /admin/import-export/exports/:id
      update-export-status.ts        POST /admin/import-export/exports/:id/status
      set-export-data.ts             POST /admin/import-export/exports/:id/data
      complete-export.ts             POST /admin/import-export/exports/:id/complete
      delete-export.ts               POST /admin/import-export/exports/:id/delete
```

## Options

```ts
ImportExportOptions {
  maxImportRows?: string      // default "10000"
  maxConcurrentImports?: string  // default "3"
}
```

## Data models

- **importJob**: id, type (products|customers|orders|inventory), status (pending|validating|processing|completed|failed|cancelled), filename, totalRows, processedRows, failedRows, skippedRows, errors (JSON), options (JSON: updateExisting, skipDuplicates, dryRun), createdBy?, completedAt?
- **exportJob**: id, type (products|customers|orders|inventory), status (pending|processing|completed|failed), format (csv|json), filters (JSON), totalRows, fileData?, createdBy?, completedAt?

## Events

Emitted via `ScopedEventEmitter` (fire-and-forget):

- `import.created` — `{ jobId, type, filename, totalRows }` — on createImport
- `import.started` — `{ jobId, type, status }` — on updateImportStatus to validating/processing
- `import.completed` — `{ jobId, type, processedRows, failedRows }` — on completeImport (when not all rows failed)
- `import.failed` — `{ jobId, type, processedRows, failedRows }` — on completeImport (when all rows failed)
- `import.cancelled` — `{ jobId, type, processedRows }` — on cancelImport
- `export.created` — `{ jobId, type, format }` — on createExport
- `export.started` — `{ jobId, type }` — on updateExportStatus to processing
- `export.completed` — `{ jobId, type, totalRows }` — on completeExport

## Patterns

- Admin-only module — no store endpoints
- Import uses row-by-row processing via `processRow()` — tracks success/failure per row
- Export data stored as serialized string in `fileData` field
- `maxConcurrentImports` enforced on `createImport()` — throws if exceeded (counts pending/validating/processing jobs)
- Controller accepts `events?: ScopedEventEmitter` and `options?: { maxConcurrentImports?: number }`
- Option values are strings (not numbers) in module config — parsed to numbers in init
- Events are fire-and-forget — failures do not break operations
