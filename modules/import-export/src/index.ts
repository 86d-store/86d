import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { importExportSchema } from "./schema";
import { createImportExportController } from "./service-impl";

export type {
	CreateExportParams,
	CreateImportParams,
	ExportFilters,
	ExportFormat,
	ExportJob,
	ExportStatus,
	ExportType,
	ImportError,
	ImportExportController,
	ImportJob,
	ImportOptions,
	ImportStatus,
	ImportType,
	ProcessRowResult,
} from "./service";

export interface ImportExportOptions extends ModuleConfig {
	/** Maximum rows allowed per import (default: 10000) */
	maxImportRows?: string;
	/** Maximum concurrent import jobs (default: 3) */
	maxConcurrentImports?: string;
}

export default function importExport(options?: ImportExportOptions): Module {
	return {
		id: "import-export",
		version: "0.0.1",
		schema: importExportSchema,
		exports: {
			read: ["importJobStatus", "exportJobStatus"],
		},
		events: {
			emits: [
				"import.created",
				"import.started",
				"import.completed",
				"import.failed",
				"import.cancelled",
				"export.created",
				"export.started",
				"export.completed",
				"export.failed",
			],
		},

		init: async (ctx: ModuleContext) => {
			const maxStr = options?.maxConcurrentImports;
			const maxConcurrent = maxStr ? Number.parseInt(maxStr, 10) : undefined;
			const controller = createImportExportController(
				ctx.data,
				ctx.events,
				maxConcurrent && !Number.isNaN(maxConcurrent)
					? { maxConcurrentImports: maxConcurrent }
					: undefined,
			);
			return {
				controllers: { importExport: controller },
			};
		},

		endpoints: {
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/import-export",
					component: "ImportExportOverview",
					label: "Import / Export",
					icon: "ArrowsDownUp",
					group: "System",
				},
				{
					path: "/admin/import-export/imports/:id",
					component: "ImportDetail",
				},
			],
		},

		options,
	};
}
