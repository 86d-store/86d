import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createImportExportController } from "../service-impl";

describe("import-export controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createImportExportController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createImportExportController(mockData);
	});

	// ── createImport edge cases ────────────────────────────────────────

	describe("createImport edge cases", () => {
		it("each import job gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const job = await controller.createImport({
					type: "products",
					filename: `file_${i}.csv`,
					totalRows: 10,
				});
				ids.add(job.id);
			}
			expect(ids.size).toBe(20);
		});

		it("createdAt and updatedAt are set to approximately current time", async () => {
			const before = new Date();
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 1,
			});
			const after = new Date();
			expect(job.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(job.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("defaults options to empty object when not provided", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			expect(job.options).toEqual({});
		});

		it("handles totalRows of 0", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "empty.csv",
				totalRows: 0,
			});
			expect(job.totalRows).toBe(0);
			expect(job.processedRows).toBe(0);
		});

		it("handles special characters in filename", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: 'file "name" (1) <special> & chars.csv',
				totalRows: 5,
			});
			expect(job.filename).toBe('file "name" (1) <special> & chars.csv');
		});

		it("handles very long filename", async () => {
			const longName = `${"A".repeat(10000)}.csv`;
			const job = await controller.createImport({
				type: "orders",
				filename: longName,
				totalRows: 1,
			});
			expect(job.filename).toBe(longName);
		});

		it("completedAt is undefined on creation", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			expect(job.completedAt).toBeUndefined();
		});
	});

	// ── getImport edge cases ───────────────────────────────────────────

	describe("getImport edge cases", () => {
		it("returns null for empty string id", async () => {
			const result = await controller.getImport("");
			expect(result).toBeNull();
		});

		it("returns null after the job has been deleted", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.deleteImport(job.id);
			expect(await controller.getImport(job.id)).toBeNull();
		});
	});

	// ── listImports edge cases ─────────────────────────────────────────

	describe("listImports edge cases", () => {
		it("returns empty array when no jobs exist", async () => {
			const all = await controller.listImports();
			expect(all).toHaveLength(0);
		});

		it("returns empty array when skip exceeds total items", async () => {
			await controller.createImport({
				type: "products",
				filename: "a.csv",
				totalRows: 10,
			});
			const result = await controller.listImports({ skip: 100 });
			expect(result).toHaveLength(0);
		});

		it("returns empty array with take=0", async () => {
			await controller.createImport({
				type: "products",
				filename: "a.csv",
				totalRows: 10,
			});
			const result = await controller.listImports({ take: 0 });
			expect(result).toHaveLength(0);
		});

		it("paginates correctly through all items", async () => {
			for (let i = 0; i < 7; i++) {
				await controller.createImport({
					type: "products",
					filename: `file_${i}.csv`,
					totalRows: 10,
				});
			}
			const page1 = await controller.listImports({ take: 3, skip: 0 });
			const page2 = await controller.listImports({ take: 3, skip: 3 });
			const page3 = await controller.listImports({ take: 3, skip: 6 });
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			expect(page3).toHaveLength(1);
			const allIds = [...page1, ...page2, ...page3].map((j) => j.id);
			expect(new Set(allIds).size).toBe(7);
		});

		it("filters by both type and status simultaneously", async () => {
			const j1 = await controller.createImport({
				type: "products",
				filename: "a.csv",
				totalRows: 10,
			});
			await controller.createImport({
				type: "customers",
				filename: "b.csv",
				totalRows: 10,
			});
			const j3 = await controller.createImport({
				type: "products",
				filename: "c.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(j1.id, "processing");
			await controller.updateImportStatus(j3.id, "completed");

			const result = await controller.listImports({
				type: "products",
				status: "processing",
			});
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(j1.id);
		});

		it("reflects deletions in subsequent list calls", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "a.csv",
				totalRows: 10,
			});
			await controller.createImport({
				type: "customers",
				filename: "b.csv",
				totalRows: 20,
			});
			expect(await controller.listImports()).toHaveLength(2);
			await controller.deleteImport(job.id);
			expect(await controller.listImports()).toHaveLength(1);
		});
	});

	// ── updateImportStatus edge cases ──────────────────────────────────

	describe("updateImportStatus edge cases", () => {
		it("sets completedAt for failed status", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			const updated = await controller.updateImportStatus(job.id, "failed");
			expect(updated?.completedAt).toBeDefined();
		});

		it("does not set completedAt for validating status", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			const updated = await controller.updateImportStatus(job.id, "validating");
			expect(updated?.completedAt).toBeUndefined();
		});

		it("can transition through multiple statuses", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			const v = await controller.updateImportStatus(job.id, "validating");
			expect(v?.status).toBe("validating");
			const p = await controller.updateImportStatus(job.id, "processing");
			expect(p?.status).toBe("processing");
			const c = await controller.updateImportStatus(job.id, "completed");
			expect(c?.status).toBe("completed");
			expect(c?.completedAt).toBeDefined();
		});
	});

	// ── processRow edge cases ──────────────────────────────────────────

	describe("processRow edge cases", () => {
		it("allows processing in validating status", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "validating");
			const result = await controller.processRow(job.id, 1, true);
			expect(result).not.toBeNull();
			expect(result?.processedRows).toBe(1);
		});

		it("returns null when job is completed", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "completed");
			expect(await controller.processRow(job.id, 1, true)).toBeNull();
		});

		it("returns null when job is cancelled", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.cancelImport(job.id);
			expect(await controller.processRow(job.id, 1, true)).toBeNull();
		});

		it("failed row without error object still increments failedRows but no error recorded", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "processing");
			const result = await controller.processRow(job.id, 1, false);
			expect(result?.failedRows).toBe(1);
			expect(result?.processedRows).toBe(1);
			expect(result?.errors).toHaveLength(0);
		});

		it("handles special characters in error message and field", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "processing");
			const result = await controller.processRow(job.id, 1, false, {
				row: 1,
				field: 'field_"special"',
				message: "Error: <script>alert('xss')</script> & more",
			});
			expect(result?.errors[0].field).toBe('field_"special"');
			expect(result?.errors[0].message).toBe(
				"Error: <script>alert('xss')</script> & more",
			);
		});

		it("handles error without field property", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "processing");
			const result = await controller.processRow(job.id, 1, false, {
				row: 1,
				message: "General error",
			});
			expect(result?.errors[0].field).toBeUndefined();
		});

		it("handles row number 0", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "processing");
			const result = await controller.processRow(job.id, 0, false, {
				row: 0,
				message: "Header error",
			});
			expect(result?.errors[0].row).toBe(0);
		});

		it("processedRows can exceed totalRows (no enforcement)", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 2,
			});
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, true);
			await controller.processRow(job.id, 2, true);
			const result = await controller.processRow(job.id, 3, true);
			expect(result?.processedRows).toBe(3);
			expect(result?.totalRows).toBe(2);
		});

		it("mixes successes and failures correctly over many rows", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "processing");
			for (let i = 1; i <= 10; i++) {
				if (i % 2 === 1) {
					await controller.processRow(job.id, i, true);
				} else {
					await controller.processRow(job.id, i, false, {
						row: i,
						message: `Error at row ${i}`,
					});
				}
			}
			const final = await controller.getImport(job.id);
			expect(final?.processedRows).toBe(10);
			expect(final?.failedRows).toBe(5);
			expect(final?.errors).toHaveLength(5);
		});
	});

	// ── completeImport edge cases ──────────────────────────────────────

	describe("completeImport edge cases", () => {
		it("marks as completed when some rows fail but not all", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 3,
			});
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, true);
			await controller.processRow(job.id, 2, false, { row: 2, message: "Bad" });
			await controller.processRow(job.id, 3, true);
			const completed = await controller.completeImport(job.id);
			expect(completed?.status).toBe("completed");
		});

		it("marks as completed when no rows processed (0 failedRows)", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			const completed = await controller.completeImport(job.id);
			expect(completed?.status).toBe("completed");
		});

		it("sets completedAt timestamp within expected range", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 1,
			});
			const before = new Date();
			const completed = await controller.completeImport(job.id);
			const after = new Date();
			expect(completed?.completedAt?.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(completed?.completedAt?.getTime()).toBeLessThanOrEqual(
				after.getTime(),
			);
		});
	});

	// ── cancelImport edge cases ────────────────────────────────────────

	describe("cancelImport edge cases", () => {
		it("cannot cancel a failed import", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "failed");
			expect(await controller.cancelImport(job.id)).toBeNull();
		});

		it("can cancel a processing import", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "processing");
			const cancelled = await controller.cancelImport(job.id);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.completedAt).toBeDefined();
		});

		it("can cancel a validating import", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.updateImportStatus(job.id, "validating");
			const cancelled = await controller.cancelImport(job.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("double cancel returns the cancelled job on second attempt", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			await controller.cancelImport(job.id);
			const second = await controller.cancelImport(job.id);
			expect(second?.status).toBe("cancelled");
		});
	});

	// ── deleteImport edge cases ────────────────────────────────────────

	describe("deleteImport edge cases", () => {
		it("double delete returns false on second attempt", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "test.csv",
				totalRows: 10,
			});
			expect(await controller.deleteImport(job.id)).toBe(true);
			expect(await controller.deleteImport(job.id)).toBe(false);
		});

		it("deleting one import does not affect others", async () => {
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
			await controller.deleteImport(job1.id);
			const remaining = await controller.getImport(job2.id);
			expect(remaining).not.toBeNull();
			expect(remaining?.filename).toBe("b.csv");
		});
	});

	// ── createExport edge cases ────────────────────────────────────────

	describe("createExport edge cases", () => {
		it("each export job gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const job = await controller.createExport({ type: "products" });
				ids.add(job.id);
			}
			expect(ids.size).toBe(20);
		});

		it("defaults format to csv and filters to empty object", async () => {
			const job = await controller.createExport({ type: "products" });
			expect(job.format).toBe("csv");
			expect(job.filters).toEqual({});
		});

		it("totalRows starts at 0 and fileData is undefined", async () => {
			const job = await controller.createExport({ type: "products" });
			expect(job.totalRows).toBe(0);
			expect(job.fileData).toBeUndefined();
		});

		it("handles partial filters", async () => {
			const job = await controller.createExport({
				type: "orders",
				filters: { dateFrom: "2026-01-01" },
			});
			expect(job.filters.dateFrom).toBe("2026-01-01");
			expect(job.filters.dateTo).toBeUndefined();
			expect(job.filters.status).toBeUndefined();
		});
	});

	// ── listExports edge cases ─────────────────────────────────────────

	describe("listExports edge cases", () => {
		it("returns empty array with take=0", async () => {
			await controller.createExport({ type: "products" });
			expect(await controller.listExports({ take: 0 })).toHaveLength(0);
		});

		it("returns empty array when skip exceeds total items", async () => {
			await controller.createExport({ type: "products" });
			expect(await controller.listExports({ skip: 100 })).toHaveLength(0);
		});

		it("filters by both type and status", async () => {
			const j1 = await controller.createExport({ type: "products" });
			const j2 = await controller.createExport({ type: "customers" });
			await controller.createExport({ type: "products" });
			await controller.updateExportStatus(j1.id, "processing");
			await controller.updateExportStatus(j2.id, "processing");

			const result = await controller.listExports({
				type: "products",
				status: "processing",
			});
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(j1.id);
		});
	});

	// ── updateExportStatus edge cases ──────────────────────────────────

	describe("updateExportStatus edge cases", () => {
		it("sets completedAt for failed status", async () => {
			const job = await controller.createExport({ type: "products" });
			const updated = await controller.updateExportStatus(job.id, "failed");
			expect(updated?.completedAt).toBeDefined();
		});

		it("does not set completedAt for processing status", async () => {
			const job = await controller.createExport({ type: "products" });
			const updated = await controller.updateExportStatus(job.id, "processing");
			expect(updated?.completedAt).toBeUndefined();
		});
	});

	// ── setExportData edge cases ───────────────────────────────────────

	describe("setExportData edge cases", () => {
		it("handles empty string data with 0 rows", async () => {
			const job = await controller.createExport({ type: "products" });
			const updated = await controller.setExportData(job.id, "", 0);
			expect(updated?.fileData).toBe("");
			expect(updated?.totalRows).toBe(0);
		});

		it("handles very large data string", async () => {
			const job = await controller.createExport({ type: "products" });
			const largeData = "x".repeat(100_000);
			const updated = await controller.setExportData(job.id, largeData, 1000);
			expect(updated?.fileData).toBe(largeData);
			expect(updated?.totalRows).toBe(1000);
		});

		it("overwrites previous data", async () => {
			const job = await controller.createExport({ type: "products" });
			await controller.setExportData(job.id, "first", 1);
			const updated = await controller.setExportData(job.id, "second", 2);
			expect(updated?.fileData).toBe("second");
			expect(updated?.totalRows).toBe(2);
		});

		it("handles data with special characters and newlines", async () => {
			const job = await controller.createExport({ type: "products" });
			const csvData =
				'id,name,description\n1,"Widget ""Pro""","Line 1\nLine 2"\n2,Gadget,<b>Bold</b>';
			const updated = await controller.setExportData(job.id, csvData, 2);
			expect(updated?.fileData).toBe(csvData);
		});
	});

	// ── deleteExport edge cases ────────────────────────────────────────

	describe("deleteExport edge cases", () => {
		it("double delete returns false on second attempt", async () => {
			const job = await controller.createExport({ type: "products" });
			expect(await controller.deleteExport(job.id)).toBe(true);
			expect(await controller.deleteExport(job.id)).toBe(false);
		});

		it("deleting one export does not affect others", async () => {
			const job1 = await controller.createExport({ type: "products" });
			const job2 = await controller.createExport({ type: "customers" });
			await controller.deleteExport(job1.id);
			expect(await controller.getExport(job2.id)).not.toBeNull();
		});
	});

	// ── count edge cases ───────────────────────────────────────────────

	describe("count edge cases", () => {
		it("countImports reflects deletions", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "a.csv",
				totalRows: 10,
			});
			await controller.createImport({
				type: "customers",
				filename: "b.csv",
				totalRows: 20,
			});
			expect(await controller.countImports()).toBe(2);
			await controller.deleteImport(job.id);
			expect(await controller.countImports()).toBe(1);
		});

		it("import and export counts are independent", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.createImport({
					type: "products",
					filename: `f${i}.csv`,
					totalRows: 1,
				});
			}
			for (let i = 0; i < 5; i++) {
				await controller.createExport({ type: "products" });
			}
			expect(await controller.countImports()).toBe(3);
			expect(await controller.countExports()).toBe(5);
		});
	});

	// ── data store consistency ──────────────────────────────────────────

	describe("data store consistency", () => {
		it("import and export stores are isolated", async () => {
			await controller.createImport({
				type: "products",
				filename: "a.csv",
				totalRows: 10,
			});
			await controller.createExport({ type: "products" });
			expect(mockData.size("importJob")).toBe(1);
			expect(mockData.size("exportJob")).toBe(1);
		});

		it("store is empty after removing all imports and exports", async () => {
			const j1 = await controller.createImport({
				type: "products",
				filename: "a.csv",
				totalRows: 10,
			});
			const j2 = await controller.createExport({ type: "products" });
			await controller.deleteImport(j1.id);
			await controller.deleteExport(j2.id);
			expect(mockData.size("importJob")).toBe(0);
			expect(mockData.size("exportJob")).toBe(0);
		});
	});

	// ── complex lifecycle scenarios ────────────────────────────────────

	describe("complex lifecycle scenarios", () => {
		it("full import lifecycle: create, validate, process, complete", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "products.csv",
				totalRows: 5,
				options: { updateExisting: true },
				createdBy: "admin_1",
			});
			expect(job.status).toBe("pending");

			await controller.updateImportStatus(job.id, "validating");
			await controller.updateImportStatus(job.id, "processing");

			await controller.processRow(job.id, 1, true);
			await controller.processRow(job.id, 2, true);
			await controller.processRow(job.id, 3, false, {
				row: 3,
				field: "price",
				message: "Invalid price",
			});
			await controller.processRow(job.id, 4, true);
			await controller.processRow(job.id, 5, true);

			const completed = await controller.completeImport(job.id);
			expect(completed?.status).toBe("completed");
			expect(completed?.processedRows).toBe(5);
			expect(completed?.failedRows).toBe(1);
			expect(completed?.errors).toHaveLength(1);
			expect(completed?.completedAt).toBeDefined();
			expect(completed?.options.updateExisting).toBe(true);
			expect(completed?.createdBy).toBe("admin_1");
		});

		it("full export lifecycle: create, process, set data, complete", async () => {
			const job = await controller.createExport({
				type: "orders",
				format: "json",
				filters: {
					dateFrom: "2026-01-01",
					dateTo: "2026-03-01",
					status: "completed",
				},
				createdBy: "admin_2",
			});
			expect(job.status).toBe("pending");

			await controller.updateExportStatus(job.id, "processing");

			const jsonData = JSON.stringify([
				{ id: "ord_1", total: 99.99 },
				{ id: "ord_2", total: 149.99 },
			]);
			await controller.setExportData(job.id, jsonData, 2);

			const completed = await controller.completeExport(job.id);
			expect(completed?.status).toBe("completed");
			expect(completed?.completedAt).toBeDefined();

			const fetched = await controller.getExport(job.id);
			expect(fetched?.fileData).toBe(jsonData);
			expect(fetched?.totalRows).toBe(2);
		});

		it("import cancelled mid-processing preserves error state", async () => {
			const job = await controller.createImport({
				type: "customers",
				filename: "customers.csv",
				totalRows: 100,
			});
			await controller.updateImportStatus(job.id, "processing");

			await controller.processRow(job.id, 1, true);
			await controller.processRow(job.id, 2, false, {
				row: 2,
				field: "email",
				message: "Invalid email",
			});
			await controller.processRow(job.id, 3, true);

			const cancelled = await controller.cancelImport(job.id);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.processedRows).toBe(3);
			expect(cancelled?.failedRows).toBe(1);
			expect(cancelled?.errors).toHaveLength(1);
		});

		it("concurrent import and export jobs are independent", async () => {
			const importJob = await controller.createImport({
				type: "products",
				filename: "products.csv",
				totalRows: 3,
			});
			const exportJob = await controller.createExport({
				type: "products",
				format: "csv",
			});

			await controller.updateImportStatus(importJob.id, "processing");
			await controller.processRow(importJob.id, 1, true);
			await controller.processRow(importJob.id, 2, true);
			await controller.processRow(importJob.id, 3, true);
			await controller.completeImport(importJob.id);

			await controller.updateExportStatus(exportJob.id, "processing");
			await controller.setExportData(
				exportJob.id,
				"id,name\n1,Widget\n2,Gadget",
				2,
			);
			await controller.completeExport(exportJob.id);

			const finalImport = await controller.getImport(importJob.id);
			const finalExport = await controller.getExport(exportJob.id);
			expect(finalImport?.status).toBe("completed");
			expect(finalExport?.status).toBe("completed");
			expect(finalImport?.processedRows).toBe(3);
			expect(finalExport?.totalRows).toBe(2);
		});

		it("delete after complete removes all data", async () => {
			const job = await controller.createImport({
				type: "products",
				filename: "products.csv",
				totalRows: 2,
			});
			await controller.updateImportStatus(job.id, "processing");
			await controller.processRow(job.id, 1, true);
			await controller.processRow(job.id, 2, false, { row: 2, message: "Bad" });
			await controller.completeImport(job.id);

			expect(await controller.deleteImport(job.id)).toBe(true);
			expect(await controller.getImport(job.id)).toBeNull();
			expect(await controller.countImports()).toBe(0);
		});

		it("multiple imports with different types tracked separately via filters", async () => {
			const prod = await controller.createImport({
				type: "products",
				filename: "p.csv",
				totalRows: 10,
			});
			const cust = await controller.createImport({
				type: "customers",
				filename: "c.csv",
				totalRows: 20,
			});
			await controller.createImport({
				type: "orders",
				filename: "o.csv",
				totalRows: 30,
			});

			await controller.updateImportStatus(prod.id, "completed");
			await controller.updateImportStatus(cust.id, "processing");

			expect(
				await controller.listImports({ status: "completed" }),
			).toHaveLength(1);
			expect(
				await controller.listImports({ status: "processing" }),
			).toHaveLength(1);
			expect(await controller.listImports({ status: "pending" })).toHaveLength(
				1,
			);
		});
	});
});
