import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createImportExportController,
	type ImportExportControllerOptions,
} from "../service-impl";

/**
 * Tests for new import-export features:
 * - Event emission for import/export lifecycle
 * - maxConcurrentImports enforcement
 * - Export status/complete/data endpoints via controller
 */

function createController(
	mockData: ReturnType<typeof createMockDataService>,
	events?: { emit: ReturnType<typeof vi.fn> },
	options?: ImportExportControllerOptions,
) {
	return createImportExportController(
		mockData,
		events as Parameters<typeof createImportExportController>[1],
		options,
	);
}

// ── Event emission ──────────────────────────────────────────────────

describe("import-export — event emission", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let emitFn: ReturnType<typeof vi.fn>;
	let events: { emit: ReturnType<typeof vi.fn> };
	let controller: ReturnType<typeof createImportExportController>;

	beforeEach(() => {
		mockData = createMockDataService();
		emitFn = vi.fn().mockResolvedValue(undefined);
		events = { emit: emitFn };
		controller = createController(mockData, events);
	});

	describe("import events", () => {
		it("emits import.created on createImport", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "products.csv",
				totalRows: 100,
			});

			expect(emitFn).toHaveBeenCalledWith("import.created", {
				jobId: job.id,
				type: "products",
				filename: "products.csv",
				totalRows: 100,
			});
		});

		it("emits import.started when status changes to validating", async () => {
			const job = await controller.createImport({
				type: "customers",
				filename: "customers.csv",
				totalRows: 50,
			});
			emitFn.mockClear();

			await controller.updateImportStatus(job.id, "validating");

			expect(emitFn).toHaveBeenCalledWith("import.started", {
				jobId: job.id,
				type: "customers",
				status: "validating",
			});
		});

		it("emits import.started when status changes to processing", async () => {
			const job = await controller.createImport({
				type: "orders",
				filename: "orders.csv",
				totalRows: 200,
			});
			emitFn.mockClear();

			await controller.updateImportStatus(job.id, "processing");

			expect(emitFn).toHaveBeenCalledWith("import.started", {
				jobId: job.id,
				type: "orders",
				status: "processing",
			});
		});

		it("emits import.completed when completeImport succeeds", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "products.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, true);
			emitFn.mockClear();

			await controller.completeImport(job.id);

			expect(emitFn).toHaveBeenCalledWith("import.completed", {
				jobId: job.id,
				type: "products",
				processedRows: 1,
				failedRows: 0,
			});
		});

		it("emits import.failed when all rows fail", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "bad.csv",
				totalRows: 2,
			});
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, false, {
				row: 1,
				message: "Invalid",
			});
			await controller.processRow(job.id, 2, false, {
				row: 2,
				message: "Bad data",
			});
			emitFn.mockClear();

			await controller.completeImport(job.id);

			expect(emitFn).toHaveBeenCalledWith("import.failed", {
				jobId: job.id,
				type: "products",
				processedRows: 2,
				failedRows: 2,
			});
		});

		it("emits import.cancelled on cancelImport", async () => {
			const job = await controller.createImport({
				type: "inventory",
				filename: "inventory.csv",
				totalRows: 500,
			});
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, true);
			emitFn.mockClear();

			await controller.cancelImport(job.id);

			expect(emitFn).toHaveBeenCalledWith("import.cancelled", {
				jobId: job.id,
				type: "inventory",
				processedRows: 1,
			});
		});

		it("does not emit when events emitter is not provided", async () => {
			const noEventController = createController(mockData);

			await noEventController.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});

			expect(emitFn).not.toHaveBeenCalled();
		});
	});

	describe("export events", () => {
		it("emits export.created on createExport", async () => {
			const job = await controller.createExport({
				type: "products",
				format: "json",
			});

			expect(emitFn).toHaveBeenCalledWith("export.created", {
				jobId: job.id,
				type: "products",
				format: "json",
			});
		});

		it("emits export.created with default csv format", async () => {
			const job = await controller.createExport({
				type: "customers",
			});

			expect(emitFn).toHaveBeenCalledWith("export.created", {
				jobId: job.id,
				type: "customers",
				format: "csv",
			});
		});

		it("emits export.started when status changes to processing", async () => {
			const job = await controller.createExport({ type: "orders" });
			emitFn.mockClear();

			await controller.updateExportStatus(job.id, "processing");

			expect(emitFn).toHaveBeenCalledWith("export.started", {
				jobId: job.id,
				type: "orders",
			});
		});

		it("does not emit export.started for non-processing status changes", async () => {
			const job = await controller.createExport({ type: "orders" });
			emitFn.mockClear();

			await controller.updateExportStatus(job.id, "completed");

			expect(emitFn).not.toHaveBeenCalledWith(
				"export.started",
				expect.anything(),
			);
		});

		it("emits export.completed on completeExport", async () => {
			const job = await controller.createExport({ type: "products" });
			await controller.setExportData(job.id, "col1,col2\na,b", 1);
			emitFn.mockClear();

			await controller.completeExport(job.id);

			expect(emitFn).toHaveBeenCalledWith("export.completed", {
				jobId: job.id,
				type: "products",
				totalRows: 1,
			});
		});
	});

	describe("event emission resilience", () => {
		it("createImport succeeds even if emit throws", async () => {
			emitFn.mockRejectedValue(new Error("emit failed"));

			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});

			expect(job.id).toBeDefined();
			expect(job.status).toBe("pending");
		});

		it("completeExport succeeds even if emit throws", async () => {
			const job = await controller.createExport({ type: "products" });
			emitFn.mockRejectedValue(new Error("emit failed"));

			const result = await controller.completeExport(job.id);
			expect(result?.status).toBe("completed");
		});
	});
});

// ── maxConcurrentImports ────────────────────────────────────────────

describe("import-export — maxConcurrentImports", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	it("allows creating imports under the limit", async () => {
		const controller = createController(mockData, undefined, {
			maxConcurrentImports: 3,
		});

		const job1 = await controller.createImport({
			type: "products",
			filename: "a.csv",
			totalRows: 10,
		});
		const job2 = await controller.createImport({
			type: "customers",
			filename: "b.csv",
			totalRows: 20,
		});

		expect(job1.id).toBeDefined();
		expect(job2.id).toBeDefined();
	});

	it("throws when concurrent imports exceed the limit", async () => {
		const controller = createController(mockData, undefined, {
			maxConcurrentImports: 2,
		});

		await controller.createImport({
			type: "products",
			filename: "a.csv",
			totalRows: 10,
		});
		await controller.createImport({
			type: "customers",
			filename: "b.csv",
			totalRows: 20,
		});

		await expect(
			controller.createImport({
				type: "orders",
				filename: "c.csv",
				totalRows: 30,
			}),
		).rejects.toThrow("Maximum concurrent imports (2) reached");
	});

	it("allows new imports after previous ones complete", async () => {
		const controller = createController(mockData, undefined, {
			maxConcurrentImports: 1,
		});

		const job = await controller.createImport({
			type: "products",
			filename: "a.csv",
			totalRows: 10,
		});
		await controller.completeImport(job.id);

		// Should succeed since the first job is completed
		const job2 = await controller.createImport({
			type: "customers",
			filename: "b.csv",
			totalRows: 20,
		});
		expect(job2.id).toBeDefined();
	});

	it("allows new imports after previous ones are cancelled", async () => {
		const controller = createController(mockData, undefined, {
			maxConcurrentImports: 1,
		});

		const job = await controller.createImport({
			type: "products",
			filename: "a.csv",
			totalRows: 10,
		});
		await controller.cancelImport(job.id);

		const job2 = await controller.createImport({
			type: "customers",
			filename: "b.csv",
			totalRows: 20,
		});
		expect(job2.id).toBeDefined();
	});

	it("counts validating and processing as active", async () => {
		const controller = createController(mockData, undefined, {
			maxConcurrentImports: 2,
		});

		const job1 = await controller.createImport({
			type: "products",
			filename: "a.csv",
			totalRows: 10,
		});
		await controller.updateImportStatus(job1.id, "validating");

		const job2 = await controller.createImport({
			type: "customers",
			filename: "b.csv",
			totalRows: 20,
		});
		await controller.updateImportStatus(job2.id, "processing");

		await expect(
			controller.createImport({
				type: "orders",
				filename: "c.csv",
				totalRows: 30,
			}),
		).rejects.toThrow("Maximum concurrent imports (2) reached");
	});

	it("does not enforce limit when option is not set", async () => {
		const controller = createController(mockData);

		for (let i = 0; i < 10; i++) {
			await controller.createImport({
				type: "products",
				filename: `file-${i}.csv`,
				totalRows: 10,
			});
		}

		const count = await controller.countImports();
		expect(count).toBe(10);
	});

	it("does not count failed imports as active", async () => {
		const controller = createController(mockData, undefined, {
			maxConcurrentImports: 1,
		});

		const job = await controller.createImport({
			type: "products",
			filename: "a.csv",
			totalRows: 10,
		});
		await controller.updateImportStatus(job.id, "failed");

		const job2 = await controller.createImport({
			type: "customers",
			filename: "b.csv",
			totalRows: 20,
		});
		expect(job2.id).toBeDefined();
	});
});

// ── Export lifecycle completeness ───────────────────────────────────

describe("import-export — export lifecycle", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createImportExportController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createController(mockData);
	});

	it("full export lifecycle: create → status → data → complete", async () => {
		const job = await controller.createExport({
			type: "products",
			format: "csv",
		});
		expect(job.status).toBe("pending");

		const processing = await controller.updateExportStatus(
			job.id,
			"processing",
		);
		expect(processing?.status).toBe("processing");

		const withData = await controller.setExportData(
			job.id,
			"id,name\n1,Widget\n2,Gadget",
			2,
		);
		expect(withData?.totalRows).toBe(2);
		expect(withData?.fileData).toContain("Widget");

		const completed = await controller.completeExport(job.id);
		expect(completed?.status).toBe("completed");
		expect(completed?.completedAt).toBeInstanceOf(Date);
	});

	it("updateExportStatus sets completedAt for terminal statuses", async () => {
		const job = await controller.createExport({ type: "orders" });

		const failed = await controller.updateExportStatus(job.id, "failed");
		expect(failed?.completedAt).toBeInstanceOf(Date);
	});

	it("updateExportStatus does not set completedAt for processing", async () => {
		const job = await controller.createExport({ type: "customers" });

		const processing = await controller.updateExportStatus(
			job.id,
			"processing",
		);
		expect(processing?.completedAt).toBeUndefined();
	});

	it("updateExportStatus returns null for non-existent job", async () => {
		const result = await controller.updateExportStatus(
			"non-existent",
			"processing",
		);
		expect(result).toBeNull();
	});

	it("setExportData returns null for non-existent job", async () => {
		const result = await controller.setExportData("non-existent", "data", 0);
		expect(result).toBeNull();
	});

	it("completeExport returns null for non-existent job", async () => {
		const result = await controller.completeExport("non-existent");
		expect(result).toBeNull();
	});

	it("setExportData preserves other job fields", async () => {
		const job = await controller.createExport({
			type: "inventory",
			format: "json",
			filters: { status: "active" },
			createdBy: "admin-1",
		});

		const updated = await controller.setExportData(job.id, '[{"id": 1}]', 1);
		expect(updated?.type).toBe("inventory");
		expect(updated?.format).toBe("json");
		expect(updated?.filters).toEqual({ status: "active" });
		expect(updated?.createdBy).toBe("admin-1");
	});

	it("setExportData can overwrite previous data", async () => {
		const job = await controller.createExport({ type: "products" });

		await controller.setExportData(job.id, "first data", 5);
		const updated = await controller.setExportData(job.id, "second data", 10);

		expect(updated?.fileData).toBe("second data");
		expect(updated?.totalRows).toBe(10);
	});
});
