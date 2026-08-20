import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	CreateExportParams,
	CreateImportParams,
	ExportJob,
	ExportStatus,
	ImportError,
	ImportExportController,
	ImportJob,
	ImportStatus,
} from "./service";

export interface ImportExportControllerOptions {
	/** Maximum concurrent import jobs allowed (pending/validating/processing) */
	maxConcurrentImports?: number | undefined;
}

export function createImportExportController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: ImportExportControllerOptions | undefined,
): ImportExportController {
	return {
		// ── Import operations ──────────────────────────────────────────

		async createImport(params: CreateImportParams): Promise<ImportJob> {
			// Enforce maxConcurrentImports
			if (options?.maxConcurrentImports) {
				const all = (await data.findMany(
					"importJob",
					{},
				)) as unknown as ImportJob[];
				const active = all.filter(
					(j) =>
						j.status === "pending" ||
						j.status === "validating" ||
						j.status === "processing",
				);
				if (active.length >= options.maxConcurrentImports) {
					throw new Error(
						`Maximum concurrent imports (${options.maxConcurrentImports}) reached`,
					);
				}
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const job: ImportJob = {
				id,
				type: params.type,
				status: "pending",
				filename: params.filename,
				totalRows: params.totalRows,
				processedRows: 0,
				failedRows: 0,
				skippedRows: 0,
				errors: [],
				options: params.options ?? {},
				createdBy: params.createdBy,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("importJob", id, job as Record<string, unknown>);

			if (events) {
				void events.emit("import.created", {
					jobId: id,
					type: params.type,
					filename: params.filename,
					totalRows: params.totalRows,
				});
			}

			return job;
		},

		async getImport(id: string): Promise<ImportJob | null> {
			const raw = await data.get("importJob", id);
			if (!raw) return null;
			return raw as unknown as ImportJob;
		},

		async listImports(params): Promise<ImportJob[]> {
			const where: Record<string, unknown> = {};
			if (params?.type) where.type = params.type;
			if (params?.status) where.status = params.status;

			const results = await data.findMany("importJob", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as ImportJob[];
		},

		async updateImportStatus(
			id: string,
			status: ImportStatus,
		): Promise<ImportJob | null> {
			const existing = await data.get("importJob", id);
			if (!existing) return null;

			const job = existing as unknown as ImportJob;
			const updated: ImportJob = {
				...job,
				status,
				updatedAt: new Date(),
				...(status === "completed" || status === "failed"
					? { completedAt: new Date() }
					: {}),
			};

			await data.upsert("importJob", id, updated as Record<string, unknown>);

			if (events && (status === "validating" || status === "processing")) {
				void events.emit("import.started", {
					jobId: id,
					type: job.type,
					status,
				});
			}

			return updated;
		},

		async processRow(
			id: string,
			rowNumber: number,
			success: boolean,
			error?: ImportError | undefined,
		): Promise<ImportJob | null> {
			const existing = await data.get("importJob", id);
			if (!existing) return null;

			const job = existing as unknown as ImportJob;
			if (job.status !== "processing" && job.status !== "validating") {
				return null;
			}

			const errors = [...job.errors];
			if (!success && error) {
				errors.push({
					row: rowNumber,
					field: error.field,
					message: error.message,
				});
			}

			const updated: ImportJob = {
				...job,
				processedRows: job.processedRows + 1,
				failedRows: success ? job.failedRows : job.failedRows + 1,
				errors,
				updatedAt: new Date(),
			};

			await data.upsert("importJob", id, updated as Record<string, unknown>);
			return updated;
		},

		async completeImport(id: string): Promise<ImportJob | null> {
			const existing = await data.get("importJob", id);
			if (!existing) return null;

			const job = existing as unknown as ImportJob;
			const now = new Date();
			const finalStatus =
				job.failedRows > 0 && job.processedRows === job.failedRows
					? "failed"
					: "completed";
			const updated: ImportJob = {
				...job,
				status: finalStatus,
				completedAt: now,
				updatedAt: now,
			};

			await data.upsert("importJob", id, updated as Record<string, unknown>);

			if (events) {
				const eventName =
					finalStatus === "failed" ? "import.failed" : "import.completed";
				void events.emit(eventName, {
					jobId: id,
					type: job.type,
					processedRows: job.processedRows,
					failedRows: job.failedRows,
				});
			}

			return updated;
		},

		async cancelImport(id: string): Promise<ImportJob | null> {
			const existing = await data.get("importJob", id);
			if (!existing) return null;

			const job = existing as unknown as ImportJob;
			if (job.status === "completed" || job.status === "failed") {
				return null;
			}

			const now = new Date();
			const updated: ImportJob = {
				...job,
				status: "cancelled",
				completedAt: now,
				updatedAt: now,
			};

			await data.upsert("importJob", id, updated as Record<string, unknown>);

			if (events) {
				void events.emit("import.cancelled", {
					jobId: id,
					type: job.type,
					processedRows: job.processedRows,
				});
			}

			return updated;
		},

		async deleteImport(id: string): Promise<boolean> {
			const existing = await data.get("importJob", id);
			if (!existing) return false;
			await data.delete("importJob", id);
			return true;
		},

		// ── Export operations ──────────────────────────────────────────

		async createExport(params: CreateExportParams): Promise<ExportJob> {
			const id = crypto.randomUUID();
			const now = new Date();

			const job: ExportJob = {
				id,
				type: params.type,
				status: "pending",
				format: params.format ?? "csv",
				filters: params.filters ?? {},
				totalRows: 0,
				createdBy: params.createdBy,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("exportJob", id, job as Record<string, unknown>);

			if (events) {
				void events.emit("export.created", {
					jobId: id,
					type: params.type,
					format: job.format,
				});
			}

			return job;
		},

		async getExport(id: string): Promise<ExportJob | null> {
			const raw = await data.get("exportJob", id);
			if (!raw) return null;
			return raw as unknown as ExportJob;
		},

		async listExports(params): Promise<ExportJob[]> {
			const where: Record<string, unknown> = {};
			if (params?.type) where.type = params.type;
			if (params?.status) where.status = params.status;

			const results = await data.findMany("exportJob", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as ExportJob[];
		},

		async updateExportStatus(
			id: string,
			status: ExportStatus,
		): Promise<ExportJob | null> {
			const existing = await data.get("exportJob", id);
			if (!existing) return null;

			const job = existing as unknown as ExportJob;
			const updated: ExportJob = {
				...job,
				status,
				updatedAt: new Date(),
				...(status === "completed" || status === "failed"
					? { completedAt: new Date() }
					: {}),
			};

			await data.upsert("exportJob", id, updated as Record<string, unknown>);

			if (events && status === "processing") {
				void events.emit("export.started", {
					jobId: id,
					type: job.type,
				});
			}

			return updated;
		},

		async setExportData(
			id: string,
			fileData: string,
			totalRows: number,
		): Promise<ExportJob | null> {
			const existing = await data.get("exportJob", id);
			if (!existing) return null;

			const job = existing as unknown as ExportJob;
			const updated: ExportJob = {
				...job,
				fileData,
				totalRows,
				updatedAt: new Date(),
			};

			await data.upsert("exportJob", id, updated as Record<string, unknown>);
			return updated;
		},

		async completeExport(id: string): Promise<ExportJob | null> {
			const existing = await data.get("exportJob", id);
			if (!existing) return null;

			const job = existing as unknown as ExportJob;
			const now = new Date();
			const updated: ExportJob = {
				...job,
				status: "completed",
				completedAt: now,
				updatedAt: now,
			};

			await data.upsert("exportJob", id, updated as Record<string, unknown>);

			if (events) {
				void events.emit("export.completed", {
					jobId: id,
					type: job.type,
					totalRows: job.totalRows,
				});
			}

			return updated;
		},

		async deleteExport(id: string): Promise<boolean> {
			const existing = await data.get("exportJob", id);
			if (!existing) return false;
			await data.delete("exportJob", id);
			return true;
		},

		async countImports(): Promise<number> {
			const all = await data.findMany("importJob", {});
			return (all as unknown as ImportJob[]).length;
		},

		async countExports(): Promise<number> {
			const all = await data.findMany("exportJob", {});
			return (all as unknown as ExportJob[]).length;
		},
	};
}
