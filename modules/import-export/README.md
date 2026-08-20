<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Import/Export Module

📚 **Documentation:** [86d.app/docs/modules/import-export](https://86d.app/docs/modules/import-export)

Manages bulk data import and export jobs for products, customers, orders, and inventory. Supports CSV and JSON formats with row-level error tracking for imports.

## Installation

```sh
npm install @86d-app/import-export
```

## Usage

```ts
import importExport from "@86d-app/import-export";

const module = importExport({
  maxImportRows: "10000",
  maxConcurrentImports: "3",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxImportRows` | `string` | `"10000"` | Maximum rows allowed per import job |
| `maxConcurrentImports` | `string` | `"3"` | Maximum number of concurrent import jobs |

## Admin Endpoints

### Imports

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/import-export/imports` | List import jobs (filterable by type, status) |
| `POST` | `/admin/import-export/imports/create` | Create a new import job |
| `GET` | `/admin/import-export/imports/:id` | Get import job details |
| `POST` | `/admin/import-export/imports/:id/status` | Update import job status |
| `POST` | `/admin/import-export/imports/:id/process-row` | Process a single import row |
| `POST` | `/admin/import-export/imports/:id/complete` | Mark import as completed |
| `POST` | `/admin/import-export/imports/:id/cancel` | Cancel an import job |
| `POST` | `/admin/import-export/imports/:id/delete` | Delete an import job |

### Exports

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/import-export/exports` | List export jobs (filterable by type, status) |
| `POST` | `/admin/import-export/exports/create` | Create a new export job |
| `GET` | `/admin/import-export/exports/:id` | Get export job details |
| `POST` | `/admin/import-export/exports/:id/status` | Update export job status |
| `POST` | `/admin/import-export/exports/:id/data` | Set export file data and row count |
| `POST` | `/admin/import-export/exports/:id/complete` | Mark export as completed |
| `POST` | `/admin/import-export/exports/:id/delete` | Delete an export job |

This module has no store-facing endpoints.

## Controller API

The `ImportExportController` interface is exported for inter-module use.

```ts
interface ImportExportController {
  // Imports
  createImport(params: CreateImportParams): Promise<ImportJob>;
  getImport(id: string): Promise<ImportJob | null>;
  listImports(params?: { type?: ImportType; status?: ImportStatus; take?: number; skip?: number }): Promise<ImportJob[]>;
  updateImportStatus(id: string, status: ImportStatus): Promise<ImportJob | null>;
  processRow(id: string, rowNumber: number, success: boolean, error?: ImportError): Promise<ImportJob | null>;
  completeImport(id: string): Promise<ImportJob | null>;
  cancelImport(id: string): Promise<ImportJob | null>;
  deleteImport(id: string): Promise<boolean>;

  // Exports
  createExport(params: CreateExportParams): Promise<ExportJob>;
  getExport(id: string): Promise<ExportJob | null>;
  listExports(params?: { type?: ExportType; status?: ExportStatus; take?: number; skip?: number }): Promise<ExportJob[]>;
  updateExportStatus(id: string, status: ExportStatus): Promise<ExportJob | null>;
  setExportData(id: string, data: string, totalRows: number): Promise<ExportJob | null>;
  completeExport(id: string): Promise<ExportJob | null>;
  deleteExport(id: string): Promise<boolean>;

  countImports(): Promise<number>;
  countExports(): Promise<number>;
}
```

## Types

```ts
type ImportType = "products" | "customers" | "orders" | "inventory";
type ImportStatus = "pending" | "validating" | "processing" | "completed" | "failed" | "cancelled";
type ExportType = "products" | "customers" | "orders" | "inventory";
type ExportStatus = "pending" | "processing" | "completed" | "failed";
type ExportFormat = "csv" | "json";

interface ImportError {
  row: number;
  field?: string;
  message: string;
}

interface ImportOptions {
  updateExisting?: boolean;
  skipDuplicates?: boolean;
  dryRun?: boolean;
}

interface ImportJob {
  id: string;
  type: ImportType;
  status: ImportStatus;
  filename: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  skippedRows: number;
  errors: ImportError[];
  options: ImportOptions;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

interface ExportJob {
  id: string;
  type: ExportType;
  status: ExportStatus;
  format: ExportFormat;
  filters: ExportFilters;
  totalRows: number;
  fileData?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

## Events

Events are emitted via `ScopedEventEmitter` (fire-and-forget):

| Event | Payload | When |
|---|---|---|
| `import.created` | `{ jobId, type, filename, totalRows }` | Import job created |
| `import.started` | `{ jobId, type, status }` | Status transitions to validating or processing |
| `import.completed` | `{ jobId, type, processedRows, failedRows }` | Import completes (not all rows failed) |
| `import.failed` | `{ jobId, type, processedRows, failedRows }` | Import completes (all rows failed) |
| `import.cancelled` | `{ jobId, type, processedRows }` | Import is cancelled |
| `export.created` | `{ jobId, type, format }` | Export job created |
| `export.started` | `{ jobId, type }` | Status transitions to processing |
| `export.completed` | `{ jobId, type, totalRows }` | Export marked as completed |

## Notes

- This is an admin-only module with no customer-facing endpoints.
- Import processing is row-by-row via `processRow()`, allowing granular error tracking per row.
- Export data is stored as a serialized string in the `fileData` field (CSV string or JSON string).
- Import options support `updateExisting`, `skipDuplicates`, and `dryRun` modes.
- `maxConcurrentImports` enforced on `createImport()` — throws if exceeded (counts pending/validating/processing jobs).
- Configuration values are strings (not numbers) for module config compatibility.
