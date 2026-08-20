import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createImportExportController } from "../service-impl";

describe("createImportExportController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createImportExportController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createImportExportController(mockData);
	});

	// ── Import: create ─────────────────────────────────────────────────

	describe("createImport", () => {
		it("creates an import job with default values", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "products.csv",
				totalRows: 100,
			});
			expect(job.id).toBeDefined();
			expect(job.type).toBe("products");
			expect(job.status).toBe("pending");
			expect(job.filename).toBe("products.csv");
			expect(job.totalRows).toBe(100);
			expect(job.processedRows).toBe(0);
			expect(job.failedRows).toBe(0);
			expect(job.skippedRows).toBe(0);
			expect(job.errors).toEqual([]);
		});

		it("stores import options", async () => {
			const job = await controller.createImport({
				type: "customers",
				filename: "customers.csv",
				totalRows: 50,
				options: { updateExisting: true, skipDuplicates: true },
			});
			expect(job.options.updateExisting).toBe(true);
			expect(job.options.skipDuplicates).toBe(true);
		});

		it("stores createdBy", async () => {
			const job = await controller.createImport({
				type: "orders",
				filename: "orders.json",
				totalRows: 200,
				createdBy: "admin_1",
			});
			expect(job.createdBy).toBe("admin_1");
		});
	});

	// ── Import: get ────────────────────────────────────────────────────

	describe("getImport", () => {
		it("returns an existing import job", async () => {
			const created = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			const found = await controller.getImport(created.id);
			expect(found?.id).toBe(created.id);
			expect(found?.filename).toBe("test.csv");
		});

		it("returns null for non-existent job", async () => {
			const found = await controller.getImport("missing");
			expect(found).toBeNull();
		});
	});

	// ── Import: list ───────────────────────────────────────────────────

	describe("listImports", () => {
		it("lists all import jobs", async () => {
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
			const all = await controller.listImports();
			expect(all).toHaveLength(2);
		});

		it("filters by type", async () => {
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
			const products = await controller.listImports({ type: "products" });
			expect(products).toHaveLength(1);
			expect(products[0].type).toBe("products");
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createImport({
					type: "products",
					filename: `file${i}.csv`,
					totalRows: 10,
				});
			}
			const page = await controller.listImports({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// ── Import: updateStatus ───────────────────────────────────────────

	describe("updateImportStatus", () => {
		it("updates the status", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			const updated = await controller.updateImportStatus(job.id, "processing");
			expect(updated?.status).toBe("processing");
		});

		it("sets completedAt for terminal statuses", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			const updated = await controller.updateImportStatus(job.id, "completed");
			expect(updated?.completedAt).toBeDefined();
		});

		it("returns null for non-existent job", async () => {
			const result = await controller.updateImportStatus(
				"missing",
				"processing",
			);
			expect(result).toBeNull();
		});
	});

	// ── Import: processRow ─────────────────────────────────────────────

	describe("processRow", () => {
		it("increments processedRows on success", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "processing");
			const updated = await controller.processRow(job.id, 1, true);
			expect(updated?.processedRows).toBe(1);
			expect(updated?.failedRows).toBe(0);
		});

		it("increments failedRows and records error on failure", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "processing");
			const updated = await controller.processRow(job.id, 3, false, {
				row: 3,
				field: "price",
				message: "Invalid number",
			});
			expect(updated?.failedRows).toBe(1);
			expect(updated?.errors).toHaveLength(1);
			expect(updated?.errors[0].row).toBe(3);
			expect(updated?.errors[0].field).toBe("price");
			expect(updated?.errors[0].message).toBe("Invalid number");
		});

		it("returns null when job is not in processable state", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			// Status is "pending" — not processable
			const result = await controller.processRow(job.id, 1, true);
			expect(result).toBeNull();
		});

		it("returns null for non-existent job", async () => {
			const result = await controller.processRow("missing", 1, true);
			expect(result).toBeNull();
		});

		it("accumulates multiple errors", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, false, {
				row: 1,
				message: "Error 1",
			});
			const updated = await controller.processRow(job.id, 2, false, {
				row: 2,
				message: "Error 2",
			});
			expect(updated?.errors).toHaveLength(2);
			expect(updated?.failedRows).toBe(2);
			expect(updated?.processedRows).toBe(2);
		});
	});

	// ── Import: complete ───────────────────────────────────────────────

	describe("completeImport", () => {
		it("marks import as completed when there are successes", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 2,
			});
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, true);
			await controller.processRow(job.id, 2, true);
			const completed = await controller.completeImport(job.id);
			expect(completed?.status).toBe("completed");
			expect(completed?.completedAt).toBeDefined();
		});

		it("marks import as failed when all rows fail", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 2,
			});
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, false, {
				row: 1,
				message: "Bad",
			});
			await controller.processRow(job.id, 2, false, {
				row: 2,
				message: "Bad",
			});
			const completed = await controller.completeImport(job.id);
			expect(completed?.status).toBe("failed");
		});

		it("returns null for non-existent job", async () => {
			const result = await controller.completeImport("missing");
			expect(result).toBeNull();
		});
	});

	// ── Import: cancel ─────────────────────────────────────────────────

	describe("cancelImport", () => {
		it("cancels a pending import", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			const cancelled = await controller.cancelImport(job.id);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.completedAt).toBeDefined();
		});

		it("cannot cancel a completed import", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "completed");
			const result = await controller.cancelImport(job.id);
			expect(result).toBeNull();
		});

		it("returns null for non-existent job", async () => {
			const result = await controller.cancelImport("missing");
			expect(result).toBeNull();
		});
	});

	// ── Import: delete ─────────────────────────────────────────────────

	describe("deleteImport", () => {
		it("deletes an import job", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			const result = await controller.deleteImport(job.id);
			expect(result).toBe(true);
			const found = await controller.getImport(job.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent job", async () => {
			const result = await controller.deleteImport("missing");
			expect(result).toBe(false);
		});
	});

	// ── Export: create ─────────────────────────────────────────────────

	describe("createExport", () => {
		it("creates an export job with default values", async () => {
			const job = await controller.createExport({ type: "products" });
			expect(job.id).toBeDefined();
			expect(job.type).toBe("products");
			expect(job.status).toBe("pending");
			expect(job.format).toBe("csv");
			expect(job.totalRows).toBe(0);
			expect(job.filters).toEqual({});
		});

		it("creates with custom format and filters", async () => {
			const job = await controller.createExport({
				type: "orders",
				format: "json",
				filters: {
					dateFrom: "2026-01-01",
					dateTo: "2026-03-01",
					status: "completed",
				},
			});
			expect(job.format).toBe("json");
			expect(job.filters.dateFrom).toBe("2026-01-01");
			expect(job.filters.dateTo).toBe("2026-03-01");
			expect(job.filters.status).toBe("completed");
		});

		it("stores createdBy", async () => {
			const job = await controller.createExport({
				type: "customers",
				createdBy: "admin_1",
			});
			expect(job.createdBy).toBe("admin_1");
		});
	});

	// ── Export: get ────────────────────────────────────────────────────

	describe("getExport", () => {
		it("returns an existing export job", async () => {
			const created = await controller.createExport({ type: "products" });
			const found = await controller.getExport(created.id);
			expect(found?.id).toBe(created.id);
		});

		it("returns null for non-existent job", async () => {
			const found = await controller.getExport("missing");
			expect(found).toBeNull();
		});
	});

	// ── Export: list ───────────────────────────────────────────────────

	describe("listExports", () => {
		it("lists all export jobs", async () => {
			await controller.createExport({ type: "products" });
			await controller.createExport({ type: "customers" });
			const all = await controller.listExports();
			expect(all).toHaveLength(2);
		});

		it("filters by type", async () => {
			await controller.createExport({ type: "products" });
			await controller.createExport({ type: "orders" });
			const orders = await controller.listExports({ type: "orders" });
			expect(orders).toHaveLength(1);
			expect(orders[0].type).toBe("orders");
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createExport({ type: "products" });
			}
			const page = await controller.listExports({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// ── Export: updateStatus ───────────────────────────────────────────

	describe("updateExportStatus", () => {
		it("updates the status", async () => {
			const job = await controller.createExport({ type: "products" });
			const updated = await controller.updateExportStatus(job.id, "processing");
			expect(updated?.status).toBe("processing");
		});

		it("sets completedAt for terminal statuses", async () => {
			const job = await controller.createExport({ type: "products" });
			const updated = await controller.updateExportStatus(job.id, "completed");
			expect(updated?.completedAt).toBeDefined();
		});

		it("returns null for non-existent job", async () => {
			const result = await controller.updateExportStatus(
				"missing",
				"processing",
			);
			expect(result).toBeNull();
		});
	});

	// ── Export: setExportData ──────────────────────────────────────────

	describe("setExportData", () => {
		it("stores export data and row count", async () => {
			const job = await controller.createExport({ type: "products" });
			const csvData = "id,name,price\n1,Widget,9.99\n2,Gadget,19.99";
			const updated = await controller.setExportData(job.id, csvData, 2);
			expect(updated?.fileData).toBe(csvData);
			expect(updated?.totalRows).toBe(2);
		});

		it("returns null for non-existent job", async () => {
			const result = await controller.setExportData("missing", "data", 0);
			expect(result).toBeNull();
		});
	});

	// ── Export: complete ───────────────────────────────────────────────

	describe("completeExport", () => {
		it("marks export as completed", async () => {
			const job = await controller.createExport({ type: "products" });
			const completed = await controller.completeExport(job.id);
			expect(completed?.status).toBe("completed");
			expect(completed?.completedAt).toBeDefined();
		});

		it("returns null for non-existent job", async () => {
			const result = await controller.completeExport("missing");
			expect(result).toBeNull();
		});
	});

	// ── Export: delete ─────────────────────────────────────────────────

	describe("deleteExport", () => {
		it("deletes an export job", async () => {
			const job = await controller.createExport({ type: "products" });
			const result = await controller.deleteExport(job.id);
			expect(result).toBe(true);
			const found = await controller.getExport(job.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent job", async () => {
			const result = await controller.deleteExport("missing");
			expect(result).toBe(false);
		});
	});

	// ── Counts ─────────────────────────────────────────────────────────

	describe("countImports", () => {
		it("counts all import jobs", async () => {
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
			const count = await controller.countImports();
			expect(count).toBe(2);
		});

		it("returns 0 when no jobs exist", async () => {
			const count = await controller.countImports();
			expect(count).toBe(0);
		});
	});

	describe("countExports", () => {
		it("counts all export jobs", async () => {
			await controller.createExport({ type: "products" });
			await controller.createExport({ type: "orders" });
			await controller.createExport({ type: "customers" });
			const count = await controller.countExports();
			expect(count).toBe(3);
		});

		it("returns 0 when no jobs exist", async () => {
			const count = await controller.countExports();
			expect(count).toBe(0);
		});
	});
});
