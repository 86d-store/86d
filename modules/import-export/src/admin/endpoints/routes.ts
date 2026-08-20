import { cancelImport } from "./cancel-import";
import { completeExport } from "./complete-export";
import { completeImport } from "./complete-import";
import { createExport } from "./create-export";
import { createImport } from "./create-import";
import { deleteExport } from "./delete-export";
import { deleteImport } from "./delete-import";
import { getExport } from "./get-export";
import { getImport } from "./get-import";
import { listExports } from "./list-exports";
import { listImports } from "./list-imports";
import { processImportRow } from "./process-import-row";
import { setExportData } from "./set-export-data";
import { updateExportStatus } from "./update-export-status";
import { updateImportStatus } from "./update-import-status";

export const adminEndpoints = {
	"/admin/import-export/imports": listImports,
	"/admin/import-export/imports/create": createImport,
	"/admin/import-export/imports/:id": getImport,
	"/admin/import-export/imports/:id/status": updateImportStatus,
	"/admin/import-export/imports/:id/process-row": processImportRow,
	"/admin/import-export/imports/:id/complete": completeImport,
	"/admin/import-export/imports/:id/cancel": cancelImport,
	"/admin/import-export/imports/:id/delete": deleteImport,
	"/admin/import-export/exports": listExports,
	"/admin/import-export/exports/create": createExport,
	"/admin/import-export/exports/:id": getExport,
	"/admin/import-export/exports/:id/status": updateExportStatus,
	"/admin/import-export/exports/:id/data": setExportData,
	"/admin/import-export/exports/:id/complete": completeExport,
	"/admin/import-export/exports/:id/delete": deleteExport,
};
