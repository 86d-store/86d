import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateExportParams, CreateImportParams } from "../service";
import { createImportExportController } from "../service-impl";

/**
 * Security regression tests for import-export endpoints.
 *
 * Import/export operations handle bulk data movement and can expose
 * sensitive information or allow unauthorized modifications.
 * These tests verify:
 * - Job isolation: one user's jobs do not leak into another's
 * - Status transition enforcement: invalid state transitions are blocked
 * - Format validation: export format defaults are safe
 * - Progress tracking integrity: row counts cannot be manipulated
 * - Cancellation guards: terminal jobs cannot be re-cancelled or modified
 * - Export data access: file data is only available on the owning job
 */

function makeImportParams(
	overrides: Partial<CreateImportParams> = {},
): CreateImportParams {
	return {
		type: "products",
		filename: "data.csv",
		totalRows: 10,
		...overrides,
	};
}

function makeExportParams(
	overrides: Partial<CreateExportParams> = {},
): CreateExportParams {
	return {
		type: "products",
		...overrides,
	};
}

describe("import-export endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createImportExportController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createImportExportController(mockData);
	});

	// ── Job Isolation ──────────────────────────────────────────────

	describe("job isolation", () => {
		it("import jobs created by different users are stored independently", async () => {
			await controller.createImport(makeImportParams({ createdBy: "admin_a" }));
			await controller.createImport(makeImportParams({ createdBy: "admin_b" }));
			await controller.createImport(makeImportParams({ createdBy: "admin_a" }));

			const all = await controller.listImports();
			const adminAJobs = all.filter((j) => j.createdBy === "admin_a");
			const adminBJobs = all.filter((j) => j.createdBy === "admin_b");
			expect(adminAJobs).toHaveLength(2);
			expect(adminBJobs).toHaveLength(1);
		});

		it("export jobs created by different users are stored independently", async () => {
			await controller.createExport(makeExportParams({ createdBy: "admin_a" }));
			await controller.createExport(makeExportParams({ createdBy: "admin_b" }));

			const all = await controller.listExports();
			const adminAJobs = all.filter((j) => j.createdBy === "admin_a");
			const adminBJobs = all.filter((j) => j.createdBy === "admin_b");
			expect(adminAJobs).toHaveLength(1);
			expect(adminBJobs).toHaveLength(1);
		});

		it("deleting one user's import job does not affect another user's jobs", async () => {
			const jobA = await controller.createImport(
				makeImportParams({ createdBy: "admin_a" }),
			);
			const jobB = await controller.createImport(
				makeImportParams({ createdBy: "admin_b" }),
			);

			await controller.deleteImport(jobA.id);

			expect(await controller.getImport(jobA.id)).toBeNull();
			expect(await controller.getImport(jobB.id)).not.toBeNull();
			expect((await controller.getImport(jobB.id))?.createdBy).toBe("admin_b");
		});

		it("deleting one user's export job does not affect another user's jobs", async () => {
			const jobA = await controller.createExport(
				makeExportParams({ createdBy: "admin_a" }),
			);
			const jobB = await controller.createExport(
				makeExportParams({ createdBy: "admin_b" }),
			);

			await controller.deleteExport(jobA.id);

			expect(await controller.getExport(jobA.id)).toBeNull();
			expect(await controller.getExport(jobB.id)).not.toBeNull();
			expect((await controller.getExport(jobB.id))?.createdBy).toBe("admin_b");
		});

		it("import and export namespaces are fully isolated", async () => {
			const imp = await controller.createImport(makeImportParams());
			const exp = await controller.createExport(makeExportParams());

			// Cross-namespace lookup must fail
			expect(await controller.getImport(exp.id)).toBeNull();
			expect(await controller.getExport(imp.id)).toBeNull();
		});
	});

	// ── Status Transition Enforcement ──────────────────────────────

	describe("status transition enforcement", () => {
		it("processRow rejects rows when import is in pending status", async () => {
			const job = await controller.createImport(makeImportParams());
			// pending is not a processable state
			const result = await controller.processRow(job.id, 1, true);
			expect(result).toBeNull();
		});

		it("processRow rejects rows when import is completed", async () => {
			const job = await controller.createImport(makeImportParams());
			await controller.updateImportStatus(job.id, "completed");
			const result = await controller.processRow(job.id, 1, true);
			expect(result).toBeNull();
		});

		it("processRow rejects rows when import is failed", async () => {
			const job = await controller.createImport(makeImportParams());
			await controller.updateImportStatus(job.id, "failed");
			const result = await controller.processRow(job.id, 1, true);
			expect(result).toBeNull();
		});

		it("processRow rejects rows when import is cancelled", async () => {
			const job = await controller.createImport(makeImportParams());
			await controller.cancelImport(job.id);
			const result = await controller.processRow(job.id, 1, true);
			expect(result).toBeNull();
		});

		it("cancelImport rejects cancellation of completed imports", async () => {
			const job = await controller.createImport(makeImportParams());
			await controller.updateImportStatus(job.id, "completed");
			const result = await controller.cancelImport(job.id);
			expect(result).toBeNull();
		});

		it("cancelImport rejects cancellation of failed imports", async () => {
			const job = await controller.createImport(makeImportParams());
			await controller.updateImportStatus(job.id, "failed");
			const result = await controller.cancelImport(job.id);
			expect(result).toBeNull();
		});
	});

	// ── Format Validation ──────────────────────────────────────────

	describe("format validation", () => {
		it("export defaults to csv format when none specified", async () => {
			const job = await controller.createExport(makeExportParams());
			expect(job.format).toBe("csv");
		});

		it("export respects explicit json format", async () => {
			const job = await controller.createExport(
				makeExportParams({ format: "json" }),
			);
			expect(job.format).toBe("json");
		});

		it("export defaults to empty filters when none specified", async () => {
			const job = await controller.createExport(makeExportParams());
			expect(job.filters).toEqual({});
		});

		it("import defaults to empty options when none specified", async () => {
			const job = await controller.createImport(makeImportParams());
			expect(job.options).toEqual({});
		});
	});

	// ── Progress Tracking Integrity ────────────────────────────────

	describe("progress tracking integrity", () => {
		it("processedRows increments exactly once per processRow call", async () => {
			const job = await controller.createImport(
				makeImportParams({ totalRows: 5 }),
			);
			await controller.updateImportStatus(job.id, "processing");

			for (let i = 1; i <= 5; i++) {
				const updated = await controller.processRow(job.id, i, true);
				expect(updated?.processedRows).toBe(i);
			}
		});

		it("failedRows only increments on failure, not success", async () => {
			const job = await controller.createImport(
				makeImportParams({ totalRows: 4 }),
			);
			await controller.updateImportStatus(job.id, "processing");

			await controller.processRow(job.id, 1, true);
			await controller.processRow(job.id, 2, false, {
				row: 2,
				message: "Bad data",
			});
			await controller.processRow(job.id, 3, true);
			const last = await controller.processRow(job.id, 4, false, {
				row: 4,
				message: "Also bad",
			});

			expect(last?.processedRows).toBe(4);
			expect(last?.failedRows).toBe(2);
			expect(last?.errors).toHaveLength(2);
		});

		it("errors accumulate correctly and preserve row references", async () => {
			const job = await controller.createImport(
				makeImportParams({ totalRows: 3 }),
			);
			await controller.updateImportStatus(job.id, "processing");

			await controller.processRow(job.id, 1, false, {
				row: 1,
				field: "name",
				message: "Missing name",
			});
			await controller.processRow(job.id, 2, false, {
				row: 2,
				field: "price",
				message: "Negative price",
			});
			const final = await controller.processRow(job.id, 3, false, {
				row: 3,
				field: "sku",
				message: "Duplicate SKU",
			});

			expect(final?.errors).toHaveLength(3);
			expect(final?.errors[0].row).toBe(1);
			expect(final?.errors[0].field).toBe("name");
			expect(final?.errors[1].row).toBe(2);
			expect(final?.errors[1].field).toBe("price");
			expect(final?.errors[2].row).toBe(3);
			expect(final?.errors[2].field).toBe("sku");
		});

		it("completeImport marks as failed when all rows fail", async () => {
			const job = await controller.createImport(
				makeImportParams({ totalRows: 2 }),
			);
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, false, {
				row: 1,
				message: "Error",
			});
			await controller.processRow(job.id, 2, false, {
				row: 2,
				message: "Error",
			});

			const completed = await controller.completeImport(job.id);
			expect(completed?.status).toBe("failed");
		});

		it("completeImport marks as completed when at least one row succeeds", async () => {
			const job = await controller.createImport(
				makeImportParams({ totalRows: 3 }),
			);
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, false, {
				row: 1,
				message: "Error",
			});
			await controller.processRow(job.id, 2, true);
			await controller.processRow(job.id, 3, false, {
				row: 3,
				message: "Error",
			});

			const completed = await controller.completeImport(job.id);
			expect(completed?.status).toBe("completed");
		});
	});

	// ── Cancellation Guards ────────────────────────────────────────

	describe("cancellation guards", () => {
		it("cancelled import preserves progress data from before cancellation", async () => {
			const job = await controller.createImport(
				makeImportParams({ totalRows: 10 }),
			);
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, true);
			await controller.processRow(job.id, 2, false, {
				row: 2,
				message: "Bad row",
			});
			await controller.processRow(job.id, 3, true);

			const cancelled = await controller.cancelImport(job.id);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.processedRows).toBe(3);
			expect(cancelled?.failedRows).toBe(1);
			expect(cancelled?.errors).toHaveLength(1);
			expect(cancelled?.completedAt).toBeDefined();
		});

		it("cannot process rows after cancellation", async () => {
			const job = await controller.createImport(
				makeImportParams({ totalRows: 10 }),
			);
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, true);

			await controller.cancelImport(job.id);

			const result = await controller.processRow(job.id, 2, true);
			expect(result).toBeNull();

			// Verify the progress was not affected
			const final = await controller.getImport(job.id);
			expect(final?.processedRows).toBe(1);
		});
	});

	// ── Export Data Access ──────────────────────────────────────────

	describe("export data access", () => {
		it("export fileData is not set until explicitly provided", async () => {
			const job = await controller.createExport(makeExportParams());
			expect(job.fileData).toBeUndefined();
		});

		it("setExportData on one job does not affect other jobs", async () => {
			const jobA = await controller.createExport(
				makeExportParams({ createdBy: "admin_a" }),
			);
			const jobB = await controller.createExport(
				makeExportParams({ createdBy: "admin_b" }),
			);

			await controller.setExportData(jobA.id, "sensitive-data-A", 100);

			const fetchedB = await controller.getExport(jobB.id);
			expect(fetchedB?.fileData).toBeUndefined();
			expect(fetchedB?.totalRows).toBe(0);
		});

		it("setExportData returns null for non-existent job ID", async () => {
			const result = await controller.setExportData(
				"non-existent-id",
				"data",
				10,
			);
			expect(result).toBeNull();
		});

		it("deleteExport removes file data from the store", async () => {
			const job = await controller.createExport(makeExportParams());
			await controller.setExportData(job.id, "sensitive-export-data", 50);
			await controller.deleteExport(job.id);

			expect(await controller.getExport(job.id)).toBeNull();
		});
	});

	// ── Non-Existent Resource Guards ───────────────────────────────

	describe("non-existent resource guards", () => {
		it("operations on non-existent import IDs return null or false", async () => {
			const fakeId = "non-existent-import-id";
			expect(await controller.getImport(fakeId)).toBeNull();
			expect(
				await controller.updateImportStatus(fakeId, "processing"),
			).toBeNull();
			expect(await controller.processRow(fakeId, 1, true)).toBeNull();
			expect(await controller.completeImport(fakeId)).toBeNull();
			expect(await controller.cancelImport(fakeId)).toBeNull();
			expect(await controller.deleteImport(fakeId)).toBe(false);
		});

		it("operations on non-existent export IDs return null or false", async () => {
			const fakeId = "non-existent-export-id";
			expect(await controller.getExport(fakeId)).toBeNull();
			expect(
				await controller.updateExportStatus(fakeId, "processing"),
			).toBeNull();
			expect(await controller.setExportData(fakeId, "data", 10)).toBeNull();
			expect(await controller.completeExport(fakeId)).toBeNull();
			expect(await controller.deleteExport(fakeId)).toBe(false);
		});
	});
});
