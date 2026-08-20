import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQrCodeController } from "../service-impl";

function defined<T>(val: T | null | undefined, label = "value"): T {
	if (val == null) throw new Error(`Expected ${label} to be defined`);
	return val;
}

describe("qr-code service-impl", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let mockEvents: { emit: ReturnType<typeof vi.fn> };
	let controller: ReturnType<typeof createQrCodeController>;

	beforeEach(() => {
		mockData = createMockDataService();
		mockEvents = { emit: vi.fn() };
		controller = createQrCodeController(mockData, mockEvents as never);
	});

	// ── create ──────────────────────────────────────────────────────

	describe("create", () => {
		it("creates a QR code with required fields", async () => {
			const qr = await controller.create({
				label: "My QR",
				targetUrl: "https://example.com",
			});

			expect(qr.id).toBeTruthy();
			expect(qr.label).toBe("My QR");
			expect(qr.targetUrl).toBe("https://example.com");
			expect(qr.createdAt).toBeInstanceOf(Date);
			expect(qr.updatedAt).toBeInstanceOf(Date);
		});

		it("applies default values", async () => {
			const qr = await controller.create({
				label: "Defaults",
				targetUrl: "https://example.com",
			});

			expect(qr.targetType).toBe("custom");
			expect(qr.format).toBe("svg");
			expect(qr.size).toBe(256);
			expect(qr.errorCorrection).toBe("M");
			expect(qr.scanCount).toBe(0);
			expect(qr.isActive).toBe(true);
			expect(qr.metadata).toEqual({});
		});

		it("respects explicit optional fields", async () => {
			const qr = await controller.create({
				label: "Product QR",
				targetUrl: "https://example.com/product/1",
				targetType: "product",
				targetId: "prod-1",
				format: "png",
				size: 512,
				errorCorrection: "H",
				metadata: { campaign: "summer" },
			});

			expect(qr.targetType).toBe("product");
			expect(qr.targetId).toBe("prod-1");
			expect(qr.format).toBe("png");
			expect(qr.size).toBe(512);
			expect(qr.errorCorrection).toBe("H");
			expect(qr.metadata).toEqual({ campaign: "summer" });
		});

		it("persists the QR code in the data store", async () => {
			const qr = await controller.create({
				label: "Persisted",
				targetUrl: "https://example.com",
			});

			const fetched = await controller.get(qr.id);
			const result = defined(fetched, "created QR code");
			expect(result.label).toBe("Persisted");
		});

		it("emits qr.created event", async () => {
			const qr = await controller.create({
				label: "Event QR",
				targetUrl: "https://example.com/event",
				targetType: "page",
			});

			expect(mockEvents.emit).toHaveBeenCalledWith("qr.created", {
				qrCodeId: qr.id,
				label: "Event QR",
				targetUrl: "https://example.com/event",
				targetType: "page",
			});
		});
	});

	// ── get ─────────────────────────────────────────────────────────

	describe("get", () => {
		it("returns the QR code by id", async () => {
			const qr = await controller.create({
				label: "Fetch me",
				targetUrl: "https://example.com",
			});

			const result = defined(await controller.get(qr.id), "QR code");
			expect(result.label).toBe("Fetch me");
			expect(result.id).toBe(qr.id);
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.get("non-existent-id");
			expect(result).toBeNull();
		});
	});

	// ── getByTarget ─────────────────────────────────────────────────

	describe("getByTarget", () => {
		it("finds QR code by target type and id", async () => {
			await controller.create({
				label: "Product QR",
				targetUrl: "https://example.com/p/1",
				targetType: "product",
				targetId: "prod-1",
			});

			const result = defined(
				await controller.getByTarget("product", "prod-1"),
				"QR by target",
			);
			expect(result.label).toBe("Product QR");
			expect(result.targetType).toBe("product");
			expect(result.targetId).toBe("prod-1");
		});

		it("returns null when no match exists", async () => {
			const result = await controller.getByTarget("order", "order-999");
			expect(result).toBeNull();
		});

		it("returns null when targetType matches but targetId does not", async () => {
			await controller.create({
				label: "Collection QR",
				targetUrl: "https://example.com/c/1",
				targetType: "collection",
				targetId: "col-1",
			});

			const result = await controller.getByTarget("collection", "col-999");
			expect(result).toBeNull();
		});
	});

	// ── update ──────────────────────────────────────────────────────

	describe("update", () => {
		it("updates specified fields only", async () => {
			const qr = await controller.create({
				label: "Original",
				targetUrl: "https://example.com",
				targetType: "custom",
			});

			const updated = defined(
				await controller.update(qr.id, { label: "Renamed" }),
				"updated QR",
			);
			expect(updated.label).toBe("Renamed");
			expect(updated.targetUrl).toBe("https://example.com");
			expect(updated.targetType).toBe("custom");
		});

		it("updates targetUrl and targetType", async () => {
			const qr = await controller.create({
				label: "Multi-field",
				targetUrl: "https://old.com",
				targetType: "custom",
			});

			const updated = defined(
				await controller.update(qr.id, {
					targetUrl: "https://new.com",
					targetType: "product",
					targetId: "prod-42",
				}),
				"updated QR",
			);
			expect(updated.targetUrl).toBe("https://new.com");
			expect(updated.targetType).toBe("product");
			expect(updated.targetId).toBe("prod-42");
		});

		it("updates format, size, and errorCorrection", async () => {
			const qr = await controller.create({
				label: "Format test",
				targetUrl: "https://example.com",
			});

			const updated = defined(
				await controller.update(qr.id, {
					format: "png",
					size: 1024,
					errorCorrection: "H",
				}),
				"updated QR",
			);
			expect(updated.format).toBe("png");
			expect(updated.size).toBe(1024);
			expect(updated.errorCorrection).toBe("H");
		});

		it("can deactivate a QR code", async () => {
			const qr = await controller.create({
				label: "Active",
				targetUrl: "https://example.com",
			});
			expect(qr.isActive).toBe(true);

			const updated = defined(
				await controller.update(qr.id, { isActive: false }),
				"deactivated QR",
			);
			expect(updated.isActive).toBe(false);
		});

		it("updates metadata", async () => {
			const qr = await controller.create({
				label: "Meta",
				targetUrl: "https://example.com",
				metadata: { v: 1 },
			});

			const updated = defined(
				await controller.update(qr.id, { metadata: { v: 2, extra: true } }),
				"updated QR",
			);
			expect(updated.metadata).toEqual({ v: 2, extra: true });
		});

		it("sets a new updatedAt timestamp", async () => {
			const qr = await controller.create({
				label: "Timestamp",
				targetUrl: "https://example.com",
			});

			const updated = defined(
				await controller.update(qr.id, { label: "Changed" }),
				"updated QR",
			);
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				qr.updatedAt.getTime(),
			);
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.update("ghost", { label: "Nope" });
			expect(result).toBeNull();
		});

		it("persists update in the data store", async () => {
			const qr = await controller.create({
				label: "Before",
				targetUrl: "https://example.com",
			});
			await controller.update(qr.id, { label: "After" });

			const fetched = defined(await controller.get(qr.id), "refetched QR");
			expect(fetched.label).toBe("After");
		});
	});

	// ── delete ──────────────────────────────────────────────────────

	describe("delete", () => {
		it("deletes an existing QR code and returns true", async () => {
			const qr = await controller.create({
				label: "Delete me",
				targetUrl: "https://example.com",
			});

			const result = await controller.delete(qr.id);
			expect(result).toBe(true);

			const fetched = await controller.get(qr.id);
			expect(fetched).toBeNull();
		});

		it("returns false for non-existent id", async () => {
			const result = await controller.delete("no-such-id");
			expect(result).toBe(false);
		});

		it("emits qr.deleted event", async () => {
			const qr = await controller.create({
				label: "Emit delete",
				targetUrl: "https://example.com",
			});
			mockEvents.emit.mockClear();

			await controller.delete(qr.id);

			expect(mockEvents.emit).toHaveBeenCalledWith("qr.deleted", {
				qrCodeId: qr.id,
			});
		});

		it("does not emit event when id does not exist", async () => {
			mockEvents.emit.mockClear();

			await controller.delete("missing-id");

			expect(mockEvents.emit).not.toHaveBeenCalled();
		});
	});

	// ── list ────────────────────────────────────────────────────────

	describe("list", () => {
		it("returns all QR codes when no filters given", async () => {
			await controller.create({
				label: "A",
				targetUrl: "https://a.com",
			});
			await controller.create({
				label: "B",
				targetUrl: "https://b.com",
			});

			const results = await controller.list();
			expect(results).toHaveLength(2);
		});

		it("filters by targetType", async () => {
			await controller.create({
				label: "Product",
				targetUrl: "https://a.com",
				targetType: "product",
			});
			await controller.create({
				label: "Page",
				targetUrl: "https://b.com",
				targetType: "page",
			});

			const results = await controller.list({ targetType: "product" });
			expect(results).toHaveLength(1);
			expect(results[0].label).toBe("Product");
		});

		it("filters by isActive", async () => {
			const qr = await controller.create({
				label: "Active",
				targetUrl: "https://a.com",
			});
			await controller.create({
				label: "Will deactivate",
				targetUrl: "https://b.com",
			});
			await controller.update(qr.id, { isActive: false });

			const active = await controller.list({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].label).toBe("Will deactivate");

			const inactive = await controller.list({ isActive: false });
			expect(inactive).toHaveLength(1);
			expect(inactive[0].label).toBe("Active");
		});

		it("supports take and skip for pagination", async () => {
			await controller.create({ label: "1", targetUrl: "https://1.com" });
			await controller.create({ label: "2", targetUrl: "https://2.com" });
			await controller.create({ label: "3", targetUrl: "https://3.com" });

			const page = await controller.list({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});

		it("returns empty array when nothing matches", async () => {
			const results = await controller.list({ targetType: "order" });
			expect(results).toEqual([]);
		});
	});

	// ── recordScan ──────────────────────────────────────────────────

	describe("recordScan", () => {
		it("creates a scan record and increments scanCount", async () => {
			const qr = await controller.create({
				label: "Scannable",
				targetUrl: "https://example.com",
			});
			expect(qr.scanCount).toBe(0);

			const scan = defined(
				await controller.recordScan(qr.id, {
					userAgent: "Mozilla/5.0",
					ipAddress: "192.168.1.1",
					referrer: "https://google.com",
				}),
				"scan record",
			);

			expect(scan.id).toBeTruthy();
			expect(scan.qrCodeId).toBe(qr.id);
			expect(scan.scannedAt).toBeInstanceOf(Date);
			expect(scan.userAgent).toBe("Mozilla/5.0");
			expect(scan.ipAddress).toBe("192.168.1.1");
			expect(scan.referrer).toBe("https://google.com");

			const updatedQr = defined(await controller.get(qr.id), "updated QR");
			expect(updatedQr.scanCount).toBe(1);
		});

		it("increments scanCount on multiple scans", async () => {
			const qr = await controller.create({
				label: "Multi-scan",
				targetUrl: "https://example.com",
			});

			await controller.recordScan(qr.id);
			await controller.recordScan(qr.id);
			await controller.recordScan(qr.id);

			const updatedQr = defined(await controller.get(qr.id), "updated QR");
			expect(updatedQr.scanCount).toBe(3);
		});

		it("records scan without optional params", async () => {
			const qr = await controller.create({
				label: "No params",
				targetUrl: "https://example.com",
			});

			const scan = defined(await controller.recordScan(qr.id), "scan record");

			expect(scan.qrCodeId).toBe(qr.id);
			expect(scan.userAgent).toBeUndefined();
			expect(scan.ipAddress).toBeUndefined();
			expect(scan.referrer).toBeUndefined();
		});

		it("returns null for non-existent QR code", async () => {
			const result = await controller.recordScan("no-such-qr");
			expect(result).toBeNull();
		});

		it("emits qr.scanned event", async () => {
			const qr = await controller.create({
				label: "Scanned event",
				targetUrl: "https://example.com/target",
			});
			mockEvents.emit.mockClear();

			const scan = defined(await controller.recordScan(qr.id), "scan record");

			expect(mockEvents.emit).toHaveBeenCalledWith("qr.scanned", {
				qrCodeId: qr.id,
				scanId: scan.id,
				targetUrl: "https://example.com/target",
			});
		});
	});

	// ── getScanCount ────────────────────────────────────────────────

	describe("getScanCount", () => {
		it("returns the current scan count", async () => {
			const qr = await controller.create({
				label: "Count me",
				targetUrl: "https://example.com",
			});

			await controller.recordScan(qr.id);
			await controller.recordScan(qr.id);

			const count = await controller.getScanCount(qr.id);
			expect(count).toBe(2);
		});

		it("returns 0 for a QR code with no scans", async () => {
			const qr = await controller.create({
				label: "No scans",
				targetUrl: "https://example.com",
			});

			const count = await controller.getScanCount(qr.id);
			expect(count).toBe(0);
		});

		it("returns 0 for non-existent QR code", async () => {
			const count = await controller.getScanCount("ghost-id");
			expect(count).toBe(0);
		});
	});

	// ── listScans ───────────────────────────────────────────────────

	describe("listScans", () => {
		it("returns scan records for a QR code", async () => {
			const qr = await controller.create({
				label: "Scan list",
				targetUrl: "https://example.com",
			});

			await controller.recordScan(qr.id, { userAgent: "Agent-1" });
			await controller.recordScan(qr.id, { userAgent: "Agent-2" });

			const scans = await controller.listScans(qr.id);
			expect(scans).toHaveLength(2);
		});

		it("supports take and skip for pagination", async () => {
			const qr = await controller.create({
				label: "Paginated scans",
				targetUrl: "https://example.com",
			});

			await controller.recordScan(qr.id);
			await controller.recordScan(qr.id);
			await controller.recordScan(qr.id);

			const page = await controller.listScans(qr.id, { take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});

		it("returns empty array when no scans exist", async () => {
			const qr = await controller.create({
				label: "Empty scans",
				targetUrl: "https://example.com",
			});

			const scans = await controller.listScans(qr.id);
			expect(scans).toEqual([]);
		});
	});

	// ── createBatch ─────────────────────────────────────────────────

	describe("createBatch", () => {
		it("creates multiple QR codes at once", async () => {
			const results = await controller.createBatch([
				{ label: "Batch-1", targetUrl: "https://1.com" },
				{ label: "Batch-2", targetUrl: "https://2.com" },
				{ label: "Batch-3", targetUrl: "https://3.com" },
			]);

			expect(results).toHaveLength(3);
			expect(results[0].label).toBe("Batch-1");
			expect(results[1].label).toBe("Batch-2");
			expect(results[2].label).toBe("Batch-3");
		});

		it("applies default values to each item", async () => {
			const results = await controller.createBatch([
				{ label: "Defaults-1", targetUrl: "https://d1.com" },
				{ label: "Defaults-2", targetUrl: "https://d2.com" },
			]);

			for (const qr of results) {
				expect(qr.targetType).toBe("custom");
				expect(qr.format).toBe("svg");
				expect(qr.size).toBe(256);
				expect(qr.errorCorrection).toBe("M");
				expect(qr.scanCount).toBe(0);
				expect(qr.isActive).toBe(true);
				expect(qr.metadata).toEqual({});
			}
		});

		it("respects per-item overrides", async () => {
			const results = await controller.createBatch([
				{
					label: "Custom",
					targetUrl: "https://custom.com",
					targetType: "product",
					targetId: "prod-5",
					format: "png",
					size: 512,
					errorCorrection: "Q",
					metadata: { batch: true },
				},
			]);

			expect(results).toHaveLength(1);
			const qr = results[0];
			expect(qr.targetType).toBe("product");
			expect(qr.targetId).toBe("prod-5");
			expect(qr.format).toBe("png");
			expect(qr.size).toBe(512);
			expect(qr.errorCorrection).toBe("Q");
			expect(qr.metadata).toEqual({ batch: true });
		});

		it("assigns unique ids to each QR code", async () => {
			const results = await controller.createBatch([
				{ label: "A", targetUrl: "https://a.com" },
				{ label: "B", targetUrl: "https://b.com" },
			]);

			expect(results[0].id).not.toBe(results[1].id);
		});

		it("emits qr.created for each item and qr.batch.created at the end", async () => {
			mockEvents.emit.mockClear();

			const results = await controller.createBatch([
				{ label: "E1", targetUrl: "https://e1.com" },
				{ label: "E2", targetUrl: "https://e2.com" },
			]);

			// Two qr.created calls + one qr.batch.created
			expect(mockEvents.emit).toHaveBeenCalledTimes(3);

			expect(mockEvents.emit).toHaveBeenCalledWith("qr.created", {
				qrCodeId: results[0].id,
				label: "E1",
				targetUrl: "https://e1.com",
				targetType: "custom",
			});

			expect(mockEvents.emit).toHaveBeenCalledWith("qr.created", {
				qrCodeId: results[1].id,
				label: "E2",
				targetUrl: "https://e2.com",
				targetType: "custom",
			});

			expect(mockEvents.emit).toHaveBeenCalledWith("qr.batch.created", {
				count: 2,
				ids: [results[0].id, results[1].id],
			});
		});

		it("persists all items in the data store", async () => {
			const results = await controller.createBatch([
				{ label: "P1", targetUrl: "https://p1.com" },
				{ label: "P2", targetUrl: "https://p2.com" },
			]);

			for (const qr of results) {
				const fetched = defined(
					await controller.get(qr.id),
					"batch-created QR",
				);
				expect(fetched.label).toBe(qr.label);
			}
		});

		it("returns empty array for empty input", async () => {
			const results = await controller.createBatch([]);
			expect(results).toEqual([]);
		});

		it("emits qr.batch.created with count 0 for empty input", async () => {
			mockEvents.emit.mockClear();

			await controller.createBatch([]);

			expect(mockEvents.emit).toHaveBeenCalledWith("qr.batch.created", {
				count: 0,
				ids: [],
			});
		});
	});

	// ── works without events ────────────────────────────────────────

	describe("without events", () => {
		it("functions correctly when no event emitter is provided", async () => {
			const noEventsController = createQrCodeController(mockData);

			const qr = await noEventsController.create({
				label: "No events",
				targetUrl: "https://example.com",
			});
			expect(qr.id).toBeTruthy();

			const scan = defined(
				await noEventsController.recordScan(qr.id),
				"scan without events",
			);
			expect(scan.qrCodeId).toBe(qr.id);

			const deleted = await noEventsController.delete(qr.id);
			expect(deleted).toBe(true);
		});
	});
});
