import { describe, expect, it, vi } from "vitest";
import { cancelImport } from "../admin/endpoints/cancel-import";
import { completeExport } from "../admin/endpoints/complete-export";
import { completeImport } from "../admin/endpoints/complete-import";
import { createExport } from "../admin/endpoints/create-export";
import { createImport } from "../admin/endpoints/create-import";
import { deleteExport } from "../admin/endpoints/delete-export";
import { deleteImport } from "../admin/endpoints/delete-import";
import { getExport } from "../admin/endpoints/get-export";
import { getImport } from "../admin/endpoints/get-import";
import { listExports } from "../admin/endpoints/list-exports";
import { listImports } from "../admin/endpoints/list-imports";
import { processImportRow } from "../admin/endpoints/process-import-row";
import { setExportData } from "../admin/endpoints/set-export-data";
import { updateExportStatus } from "../admin/endpoints/update-export-status";
import { updateImportStatus } from "../admin/endpoints/update-import-status";
import type { ExportJob, ImportExportController, ImportJob } from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeImportJob(overrides: Partial<ImportJob> = {}): ImportJob {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		type: "products",
		status: "pending",
		filename: "products.csv",
		totalRows: 100,
		processedRows: 0,
		failedRows: 0,
		skippedRows: 0,
		errors: [],
		options: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeExportJob(overrides: Partial<ExportJob> = {}): ExportJob {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		type: "products",
		status: "pending",
		format: "csv",
		filters: {},
		totalRows: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<ImportExportController> = {},
): ImportExportController {
	return {
		createImport: vi.fn().mockResolvedValue(makeImportJob()),
		getImport: vi.fn().mockResolvedValue(null),
		listImports: vi.fn().mockResolvedValue([]),
		updateImportStatus: vi.fn().mockResolvedValue(null),
		processRow: vi.fn().mockResolvedValue(null),
		completeImport: vi.fn().mockResolvedValue(null),
		cancelImport: vi.fn().mockResolvedValue(null),
		deleteImport: vi.fn().mockResolvedValue(false),
		createExport: vi.fn().mockResolvedValue(makeExportJob()),
		getExport: vi.fn().mockResolvedValue(null),
		listExports: vi.fn().mockResolvedValue([]),
		updateExportStatus: vi.fn().mockResolvedValue(null),
		setExportData: vi.fn().mockResolvedValue(null),
		completeExport: vi.fn().mockResolvedValue(null),
		deleteExport: vi.fn().mockResolvedValue(false),
		countImports: vi.fn().mockResolvedValue(0),
		countExports: vi.fn().mockResolvedValue(0),
		...overrides,
	} as ImportExportController;
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: ImportExportController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { importExport: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const createImportHandler = extractHandler(createImport);
const getImportHandler = extractHandler(getImport);
const listImportsHandler = extractHandler(listImports);
const updateImportStatusHandler = extractHandler(updateImportStatus);
const processImportRowHandler = extractHandler(processImportRow);
const completeImportHandler = extractHandler(completeImport);
const cancelImportHandler = extractHandler(cancelImport);
const deleteImportHandler = extractHandler(deleteImport);
const createExportHandler = extractHandler(createExport);
const getExportHandler = extractHandler(getExport);
const listExportsHandler = extractHandler(listExports);
const updateExportStatusHandler = extractHandler(updateExportStatus);
const setExportDataHandler = extractHandler(setExportData);
const completeExportHandler = extractHandler(completeExport);
const deleteExportHandler = extractHandler(deleteExport);

// ── createImport ──────────────────────────────────────────────────────────────

describe("admin POST /import-export/imports/create", () => {
	it("creates import job and returns it", async () => {
		const job = makeImportJob({ type: "products", filename: "upload.csv" });
		const ctrl = makeController({
			createImport: vi.fn().mockResolvedValue(job),
		});
		const result = (await call(createImportHandler, {
			body: { type: "products", filename: "upload.csv", totalRows: 50 },
			controller: ctrl,
		})) as { job: ImportJob };
		expect(result.job.type).toBe("products");
		expect(result.job.filename).toBe("upload.csv");
		expect(ctrl.createImport).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "products",
				filename: "upload.csv",
				totalRows: 50,
			}),
		);
	});

	it("passes import options to controller", async () => {
		const ctrl = makeController();
		await call(createImportHandler, {
			body: {
				type: "customers",
				filename: "customers.csv",
				totalRows: 200,
				options: { updateExisting: true, skipDuplicates: false },
			},
			controller: ctrl,
		});
		expect(ctrl.createImport).toHaveBeenCalledWith(
			expect.objectContaining({
				options: { updateExisting: true, skipDuplicates: false },
			}),
		);
	});
});

// ── getImport ─────────────────────────────────────────────────────────────────

describe("admin GET /import-export/imports/:id", () => {
	it("returns 404 when import job not found", async () => {
		const result = (await call(getImportHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Import job not found");
	});

	it("returns import job when found", async () => {
		const job = makeImportJob({ id: "imp_1", status: "processing" });
		const ctrl = makeController({
			getImport: vi.fn().mockResolvedValue(job),
		});
		const result = (await call(getImportHandler, {
			params: { id: "imp_1" },
			controller: ctrl,
		})) as { job: ImportJob };
		expect(result.job.id).toBe("imp_1");
		expect(result.job.status).toBe("processing");
		expect(ctrl.getImport).toHaveBeenCalledWith("imp_1");
	});
});

// ── listImports ───────────────────────────────────────────────────────────────

describe("admin GET /import-export/imports", () => {
	it("returns empty list when no import jobs exist", async () => {
		const result = (await call(listImportsHandler)) as {
			jobs: ImportJob[];
			total: number;
		};
		expect(result.jobs).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("passes type and status filters with default pagination", async () => {
		const jobs = [makeImportJob({ type: "orders", status: "completed" })];
		const ctrl = makeController({
			listImports: vi.fn().mockResolvedValue(jobs),
		});
		const result = (await call(listImportsHandler, {
			query: { type: "orders", status: "completed" },
			controller: ctrl,
		})) as { jobs: ImportJob[]; total: number };
		expect(result.jobs).toHaveLength(1);
		expect(result.total).toBe(1);
		// After the fix, take/skip are applied in-memory; controller receives only filters
		expect(ctrl.listImports).toHaveBeenCalledWith(
			expect.objectContaining({ type: "orders", status: "completed" }),
		);
		expect(ctrl.listImports).toHaveBeenCalledWith(
			expect.not.objectContaining({ take: expect.anything() }),
		);
	});
});

// ── updateImportStatus ────────────────────────────────────────────────────────

describe("admin POST /import-export/imports/:id/status", () => {
	it("returns 404 when import job not found", async () => {
		const result = (await call(updateImportStatusHandler, {
			params: { id: "missing" },
			body: { status: "processing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates import status and returns updated job", async () => {
		const job = makeImportJob({ id: "imp_2", status: "processing" });
		const ctrl = makeController({
			updateImportStatus: vi.fn().mockResolvedValue(job),
		});
		const result = (await call(updateImportStatusHandler, {
			params: { id: "imp_2" },
			body: { status: "processing" },
			controller: ctrl,
		})) as { job: ImportJob };
		expect(result.job.status).toBe("processing");
		expect(ctrl.updateImportStatus).toHaveBeenCalledWith("imp_2", "processing");
	});
});

// ── processImportRow ──────────────────────────────────────────────────────────

describe("admin POST /import-export/imports/:id/process-row", () => {
	it("returns 404 when import job not found", async () => {
		const result = (await call(processImportRowHandler, {
			params: { id: "missing" },
			body: { rowNumber: 1, success: true },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("processes a successful row and returns updated job", async () => {
		const job = makeImportJob({ id: "imp_3", processedRows: 1 });
		const ctrl = makeController({
			processRow: vi.fn().mockResolvedValue(job),
		});
		const result = (await call(processImportRowHandler, {
			params: { id: "imp_3" },
			body: { rowNumber: 1, success: true },
			controller: ctrl,
		})) as { job: ImportJob };
		expect(result.job.processedRows).toBe(1);
		expect(ctrl.processRow).toHaveBeenCalledWith("imp_3", 1, true, undefined);
	});
});

// ── completeImport ────────────────────────────────────────────────────────────

describe("admin POST /import-export/imports/:id/complete", () => {
	it("returns 404 when import job not found", async () => {
		const result = (await call(completeImportHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("completes import and returns job with completed status", async () => {
		const job = makeImportJob({ id: "imp_4", status: "completed" });
		const ctrl = makeController({
			completeImport: vi.fn().mockResolvedValue(job),
		});
		const result = (await call(completeImportHandler, {
			params: { id: "imp_4" },
			controller: ctrl,
		})) as { job: ImportJob };
		expect(result.job.status).toBe("completed");
		expect(ctrl.completeImport).toHaveBeenCalledWith("imp_4");
	});
});

// ── cancelImport ──────────────────────────────────────────────────────────────

describe("admin POST /import-export/imports/:id/cancel", () => {
	it("returns 404 when import job not found or already completed", async () => {
		const result = (await call(cancelImportHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("cancels import and returns job with cancelled status", async () => {
		const job = makeImportJob({ id: "imp_5", status: "cancelled" });
		const ctrl = makeController({
			cancelImport: vi.fn().mockResolvedValue(job),
		});
		const result = (await call(cancelImportHandler, {
			params: { id: "imp_5" },
			controller: ctrl,
		})) as { job: ImportJob };
		expect(result.job.status).toBe("cancelled");
		expect(ctrl.cancelImport).toHaveBeenCalledWith("imp_5");
	});
});

// ── deleteImport ──────────────────────────────────────────────────────────────

describe("admin POST /import-export/imports/:id/delete", () => {
	it("returns 404 when import job not found", async () => {
		const result = (await call(deleteImportHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes import job and returns success", async () => {
		const ctrl = makeController({
			deleteImport: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteImportHandler, {
			params: { id: "imp_6" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteImport).toHaveBeenCalledWith("imp_6");
	});
});

// ── createExport ──────────────────────────────────────────────────────────────

describe("admin POST /import-export/exports/create", () => {
	it("creates export job and returns it", async () => {
		const job = makeExportJob({ type: "customers", format: "json" });
		const ctrl = makeController({
			createExport: vi.fn().mockResolvedValue(job),
		});
		const result = (await call(createExportHandler, {
			body: { type: "customers", format: "json" },
			controller: ctrl,
		})) as { job: ExportJob };
		expect(result.job.type).toBe("customers");
		expect(result.job.format).toBe("json");
		expect(ctrl.createExport).toHaveBeenCalledWith(
			expect.objectContaining({ type: "customers", format: "json" }),
		);
	});

	it("passes filters to controller", async () => {
		const ctrl = makeController();
		await call(createExportHandler, {
			body: {
				type: "orders",
				filters: {
					dateFrom: "2025-01-01",
					dateTo: "2025-12-31",
					status: "completed",
				},
			},
			controller: ctrl,
		});
		expect(ctrl.createExport).toHaveBeenCalledWith(
			expect.objectContaining({
				filters: {
					dateFrom: "2025-01-01",
					dateTo: "2025-12-31",
					status: "completed",
				},
			}),
		);
	});
});

// ── getExport ─────────────────────────────────────────────────────────────────

describe("admin GET /import-export/exports/:id", () => {
	it("returns 404 when export job not found", async () => {
		const result = (await call(getExportHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Export job not found");
	});

	it("returns export job when found", async () => {
		const job = makeExportJob({ id: "exp_1", status: "completed" });
		const ctrl = makeController({
			getExport: vi.fn().mockResolvedValue(job),
		});
		const result = (await call(getExportHandler, {
			params: { id: "exp_1" },
			controller: ctrl,
		})) as { job: ExportJob };
		expect(result.job.id).toBe("exp_1");
		expect(result.job.status).toBe("completed");
		expect(ctrl.getExport).toHaveBeenCalledWith("exp_1");
	});
});

// ── listExports ───────────────────────────────────────────────────────────────

describe("admin GET /import-export/exports", () => {
	it("returns empty list when no export jobs exist", async () => {
		const result = (await call(listExportsHandler)) as {
			jobs: ExportJob[];
			total: number;
		};
		expect(result.jobs).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("passes type and status filters with default pagination", async () => {
		const jobs = [makeExportJob({ type: "inventory", status: "processing" })];
		const ctrl = makeController({
			listExports: vi.fn().mockResolvedValue(jobs),
		});
		const result = (await call(listExportsHandler, {
			query: { type: "inventory", status: "processing" },
			controller: ctrl,
		})) as { jobs: ExportJob[]; total: number };
		expect(result.jobs).toHaveLength(1);
		expect(result.total).toBe(1);
		// After the fix, take/skip are applied in-memory; controller receives only filters
		expect(ctrl.listExports).toHaveBeenCalledWith(
			expect.objectContaining({ type: "inventory", status: "processing" }),
		);
		expect(ctrl.listExports).toHaveBeenCalledWith(
			expect.not.objectContaining({ take: expect.anything() }),
		);
	});
});

// ── updateExportStatus ────────────────────────────────────────────────────────

describe("admin POST /import-export/exports/:id/status", () => {
	it("returns 404 when export job not found", async () => {
		const result = (await call(updateExportStatusHandler, {
			params: { id: "missing" },
			body: { status: "processing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates export status and returns updated job", async () => {
		const job = makeExportJob({ id: "exp_2", status: "processing" });
		const ctrl = makeController({
			updateExportStatus: vi.fn().mockResolvedValue(job),
		});
		const result = (await call(updateExportStatusHandler, {
			params: { id: "exp_2" },
			body: { status: "processing" },
			controller: ctrl,
		})) as { job: ExportJob };
		expect(result.job.status).toBe("processing");
		expect(ctrl.updateExportStatus).toHaveBeenCalledWith("exp_2", "processing");
	});
});

// ── setExportData ─────────────────────────────────────────────────────────────

describe("admin POST /import-export/exports/:id/data", () => {
	it("returns 404 when export job not found", async () => {
		const result = (await call(setExportDataHandler, {
			params: { id: "missing" },
			body: { data: "col1,col2\nv1,v2", totalRows: 1 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("sets export data and returns updated job", async () => {
		const csvData = "name,price\nWidget,9.99";
		const job = makeExportJob({ id: "exp_3", totalRows: 1, fileData: csvData });
		const ctrl = makeController({
			setExportData: vi.fn().mockResolvedValue(job),
		});
		const result = (await call(setExportDataHandler, {
			params: { id: "exp_3" },
			body: { data: csvData, totalRows: 1 },
			controller: ctrl,
		})) as { job: ExportJob };
		expect(result.job.totalRows).toBe(1);
		expect(ctrl.setExportData).toHaveBeenCalledWith("exp_3", csvData, 1);
	});
});

// ── completeExport ────────────────────────────────────────────────────────────

describe("admin POST /import-export/exports/:id/complete", () => {
	it("returns 404 when export job not found", async () => {
		const result = (await call(completeExportHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("completes export and returns job with completed status", async () => {
		const job = makeExportJob({ id: "exp_4", status: "completed" });
		const ctrl = makeController({
			completeExport: vi.fn().mockResolvedValue(job),
		});
		const result = (await call(completeExportHandler, {
			params: { id: "exp_4" },
			controller: ctrl,
		})) as { job: ExportJob };
		expect(result.job.status).toBe("completed");
		expect(ctrl.completeExport).toHaveBeenCalledWith("exp_4");
	});
});

// ── deleteExport ──────────────────────────────────────────────────────────────

describe("admin POST /import-export/exports/:id/delete", () => {
	it("returns 404 when export job not found", async () => {
		const result = (await call(deleteExportHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes export job and returns success", async () => {
		const ctrl = makeController({
			deleteExport: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteExportHandler, {
			params: { id: "exp_5" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteExport).toHaveBeenCalledWith("exp_5");
	});
});
