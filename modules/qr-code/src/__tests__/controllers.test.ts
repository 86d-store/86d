import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createQrCodeController } from "../service-impl";

describe("qr-code controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createQrCodeController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createQrCodeController(mockData);
	});

	// ── create ────────────────────────────────────────────────────────

	describe("create", () => {
		it("creates a QR code with required fields", async () => {
			const qr = await controller.create({
				label: "Product Page",
				targetUrl: "https://example.com/product/1",
			});

			expect(qr.id).toBeDefined();
			expect(qr.label).toBe("Product Page");
			expect(qr.targetUrl).toBe("https://example.com/product/1");
			expect(qr.targetType).toBe("custom");
			expect(qr.format).toBe("svg");
			expect(qr.size).toBe(256);
			expect(qr.errorCorrection).toBe("M");
			expect(qr.scanCount).toBe(0);
			expect(qr.isActive).toBe(true);
			expect(qr.metadata).toEqual({});
			expect(qr.createdAt).toBeInstanceOf(Date);
			expect(qr.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a QR code with all optional fields", async () => {
			const qr = await controller.create({
				label: "Product QR",
				targetUrl: "https://example.com/p/123",
				targetType: "product",
				targetId: "prod-123",
				format: "png",
				size: 512,
				errorCorrection: "H",
				metadata: { campaign: "summer" },
			});

			expect(qr.targetType).toBe("product");
			expect(qr.targetId).toBe("prod-123");
			expect(qr.format).toBe("png");
			expect(qr.size).toBe(512);
			expect(qr.errorCorrection).toBe("H");
			expect(qr.metadata).toEqual({ campaign: "summer" });
		});

		it("generates unique IDs for each QR code", async () => {
			const qr1 = await controller.create({
				label: "QR 1",
				targetUrl: "https://example.com/1",
			});
			const qr2 = await controller.create({
				label: "QR 2",
				targetUrl: "https://example.com/2",
			});

			expect(qr1.id).not.toBe(qr2.id);
		});
	});

	// ── get ───────────────────────────────────────────────────────────

	describe("get", () => {
		it("returns a QR code by ID", async () => {
			const created = await controller.create({
				label: "Test",
				targetUrl: "https://example.com",
			});

			const found = await controller.get(created.id);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.label).toBe("Test");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.get("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── getByTarget ──────────────────────────────────────────────────

	describe("getByTarget", () => {
		it("finds a QR code by target type and target ID", async () => {
			await controller.create({
				label: "Product QR",
				targetUrl: "https://example.com/p/123",
				targetType: "product",
				targetId: "prod-123",
			});

			const found = await controller.getByTarget("product", "prod-123");
			expect(found).not.toBeNull();
			expect(found?.targetType).toBe("product");
			expect(found?.targetId).toBe("prod-123");
		});

		it("returns null when no matching target exists", async () => {
			const result = await controller.getByTarget("product", "non-existent");
			expect(result).toBeNull();
		});
	});

	// ── update ───────────────────────────────────────────────────────

	describe("update", () => {
		it("updates label only, preserving other fields", async () => {
			const created = await controller.create({
				label: "Original",
				targetUrl: "https://example.com",
				targetType: "product",
				targetId: "prod-1",
				format: "png",
				size: 512,
			});

			const updated = await controller.update(created.id, {
				label: "Updated",
			});

			expect(updated?.label).toBe("Updated");
			expect(updated?.targetUrl).toBe("https://example.com");
			expect(updated?.targetType).toBe("product");
			expect(updated?.targetId).toBe("prod-1");
			expect(updated?.format).toBe("png");
			expect(updated?.size).toBe(512);
		});

		it("updates multiple fields at once", async () => {
			const created = await controller.create({
				label: "Original",
				targetUrl: "https://example.com",
			});

			const updated = await controller.update(created.id, {
				label: "New Label",
				targetUrl: "https://new.example.com",
				format: "png",
				size: 1024,
				isActive: false,
			});

			expect(updated?.label).toBe("New Label");
			expect(updated?.targetUrl).toBe("https://new.example.com");
			expect(updated?.format).toBe("png");
			expect(updated?.size).toBe(1024);
			expect(updated?.isActive).toBe(false);
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.update("non-existent", {
				label: "Nope",
			});
			expect(result).toBeNull();
		});

		it("updates updatedAt timestamp", async () => {
			const created = await controller.create({
				label: "Test",
				targetUrl: "https://example.com",
			});

			const updated = await controller.update(created.id, {
				label: "Changed",
			});

			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("sequential partial updates accumulate correctly", async () => {
			const created = await controller.create({
				label: "Start",
				targetUrl: "https://example.com",
			});

			await controller.update(created.id, { label: "Step 1" });
			await controller.update(created.id, { format: "png" });
			await controller.update(created.id, { size: 1024 });

			const final = await controller.get(created.id);
			expect(final?.label).toBe("Step 1");
			expect(final?.format).toBe("png");
			expect(final?.size).toBe(1024);
		});
	});

	// ── delete ───────────────────────────────────────────────────────

	describe("delete", () => {
		it("deletes an existing QR code", async () => {
			const created = await controller.create({
				label: "Delete Me",
				targetUrl: "https://example.com",
			});

			const result = await controller.delete(created.id);
			expect(result).toBe(true);

			const check = await controller.get(created.id);
			expect(check).toBeNull();
		});

		it("returns false for non-existent ID", async () => {
			const result = await controller.delete("non-existent");
			expect(result).toBe(false);
		});

		it("double deletion returns false on second attempt", async () => {
			const created = await controller.create({
				label: "Test",
				targetUrl: "https://example.com",
			});

			expect(await controller.delete(created.id)).toBe(true);
			expect(await controller.delete(created.id)).toBe(false);
		});

		it("deleted QR code is removed from list", async () => {
			await controller.create({
				label: "Keep",
				targetUrl: "https://example.com/keep",
			});
			const qr2 = await controller.create({
				label: "Remove",
				targetUrl: "https://example.com/remove",
			});

			await controller.delete(qr2.id);

			const all = await controller.list();
			expect(all).toHaveLength(1);
			expect(all[0].label).toBe("Keep");
		});
	});

	// ── list ─────────────────────────────────────────────────────────

	describe("list", () => {
		it("returns all QR codes", async () => {
			await controller.create({
				label: "QR 1",
				targetUrl: "https://example.com/1",
			});
			await controller.create({
				label: "QR 2",
				targetUrl: "https://example.com/2",
			});

			const all = await controller.list();
			expect(all).toHaveLength(2);
		});

		it("filters by targetType", async () => {
			await controller.create({
				label: "Product QR",
				targetUrl: "https://example.com/p",
				targetType: "product",
			});
			await controller.create({
				label: "Page QR",
				targetUrl: "https://example.com/page",
				targetType: "page",
			});
			await controller.create({
				label: "Another Product",
				targetUrl: "https://example.com/p2",
				targetType: "product",
			});

			const products = await controller.list({ targetType: "product" });
			expect(products).toHaveLength(2);
			expect(products.every((q) => q.targetType === "product")).toBe(true);
		});

		it("filters by isActive", async () => {
			const qr = await controller.create({
				label: "Active",
				targetUrl: "https://example.com/active",
			});
			await controller.create({
				label: "Also Active",
				targetUrl: "https://example.com/also",
			});
			await controller.update(qr.id, { isActive: false });

			const active = await controller.list({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].label).toBe("Also Active");
		});

		it("respects take and skip pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create({
					label: `QR ${i}`,
					targetUrl: `https://example.com/${i}`,
				});
			}

			const page = await controller.list({ take: 2 });
			expect(page).toHaveLength(2);
		});

		it("skip beyond total returns empty array", async () => {
			await controller.create({
				label: "Only",
				targetUrl: "https://example.com",
			});

			const result = await controller.list({ skip: 100 });
			expect(result).toEqual([]);
		});

		it("returns empty array when none exist", async () => {
			const all = await controller.list();
			expect(all).toEqual([]);
		});
	});

	// ── recordScan ───────────────────────────────────────────────────

	describe("recordScan", () => {
		it("records a scan and increments scanCount", async () => {
			const qr = await controller.create({
				label: "Scannable",
				targetUrl: "https://example.com",
			});

			const scan = await controller.recordScan(qr.id);
			expect(scan).not.toBeNull();
			expect(scan?.qrCodeId).toBe(qr.id);
			expect(scan?.scannedAt).toBeInstanceOf(Date);

			const updated = await controller.get(qr.id);
			expect(updated?.scanCount).toBe(1);
		});

		it("records scan with optional params", async () => {
			const qr = await controller.create({
				label: "Test",
				targetUrl: "https://example.com",
			});

			const scan = await controller.recordScan(qr.id, {
				userAgent: "Mozilla/5.0",
				ipAddress: "192.168.1.1",
				referrer: "https://google.com",
			});

			expect(scan?.userAgent).toBe("Mozilla/5.0");
			expect(scan?.ipAddress).toBe("192.168.1.1");
			expect(scan?.referrer).toBe("https://google.com");
		});

		it("returns null for non-existent QR code", async () => {
			const result = await controller.recordScan("non-existent");
			expect(result).toBeNull();
		});

		it("multiple scans increment count correctly", async () => {
			const qr = await controller.create({
				label: "Popular",
				targetUrl: "https://example.com",
			});

			await controller.recordScan(qr.id);
			await controller.recordScan(qr.id);
			await controller.recordScan(qr.id);

			const updated = await controller.get(qr.id);
			expect(updated?.scanCount).toBe(3);
		});
	});

	// ── getScanCount ─────────────────────────────────────────────────

	describe("getScanCount", () => {
		it("returns 0 for new QR code", async () => {
			const qr = await controller.create({
				label: "New",
				targetUrl: "https://example.com",
			});

			const count = await controller.getScanCount(qr.id);
			expect(count).toBe(0);
		});

		it("returns correct count after scans", async () => {
			const qr = await controller.create({
				label: "Counted",
				targetUrl: "https://example.com",
			});

			await controller.recordScan(qr.id);
			await controller.recordScan(qr.id);

			const count = await controller.getScanCount(qr.id);
			expect(count).toBe(2);
		});

		it("returns 0 for non-existent QR code", async () => {
			const count = await controller.getScanCount("non-existent");
			expect(count).toBe(0);
		});
	});

	// ── listScans ────────────────────────────────────────────────────

	describe("listScans", () => {
		it("lists scans for a QR code", async () => {
			const qr = await controller.create({
				label: "Scanned",
				targetUrl: "https://example.com",
			});

			await controller.recordScan(qr.id, { userAgent: "Agent 1" });
			await controller.recordScan(qr.id, { userAgent: "Agent 2" });

			const scans = await controller.listScans(qr.id);
			expect(scans).toHaveLength(2);
		});

		it("returns empty array when no scans exist", async () => {
			const qr = await controller.create({
				label: "No Scans",
				targetUrl: "https://example.com",
			});

			const scans = await controller.listScans(qr.id);
			expect(scans).toEqual([]);
		});

		it("respects pagination", async () => {
			const qr = await controller.create({
				label: "Paginated",
				targetUrl: "https://example.com",
			});

			for (let i = 0; i < 5; i++) {
				await controller.recordScan(qr.id);
			}

			const page = await controller.listScans(qr.id, { take: 2 });
			expect(page).toHaveLength(2);
		});
	});

	// ── createBatch ──────────────────────────────────────────────────

	describe("createBatch", () => {
		it("creates multiple QR codes at once", async () => {
			const results = await controller.createBatch([
				{ label: "Batch 1", targetUrl: "https://example.com/1" },
				{ label: "Batch 2", targetUrl: "https://example.com/2" },
				{
					label: "Batch 3",
					targetUrl: "https://example.com/3",
					targetType: "product",
				},
			]);

			expect(results).toHaveLength(3);
			expect(results[0].label).toBe("Batch 1");
			expect(results[1].label).toBe("Batch 2");
			expect(results[2].targetType).toBe("product");
		});

		it("each batch item gets a unique ID", async () => {
			const results = await controller.createBatch([
				{ label: "A", targetUrl: "https://example.com/a" },
				{ label: "B", targetUrl: "https://example.com/b" },
			]);

			const ids = new Set(results.map((r) => r.id));
			expect(ids.size).toBe(2);
		});

		it("batch items appear in list", async () => {
			await controller.createBatch([
				{ label: "X", targetUrl: "https://example.com/x" },
				{ label: "Y", targetUrl: "https://example.com/y" },
			]);

			const all = await controller.list();
			expect(all).toHaveLength(2);
		});

		it("empty batch returns empty array", async () => {
			const results = await controller.createBatch([]);
			expect(results).toEqual([]);
		});
	});

	// ── data store consistency ────────────────────────────────────────

	describe("data store consistency", () => {
		it("QR code count in store matches list length", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create({
					label: `QR ${i}`,
					targetUrl: `https://example.com/${i}`,
				});
			}

			const all = await controller.list();
			expect(all).toHaveLength(5);
			expect(mockData.size("qrCode")).toBe(5);
		});

		it("scan records persist in store", async () => {
			const qr = await controller.create({
				label: "Persistent",
				targetUrl: "https://example.com",
			});

			await controller.recordScan(qr.id);
			await controller.recordScan(qr.id);

			expect(mockData.size("qrScan")).toBe(2);
		});
	});

	// ── concurrent operations ────────────────────────────────────────

	describe("concurrent operations", () => {
		it("concurrent creates produce distinct records", async () => {
			const promises = Array.from({ length: 10 }, (_, i) =>
				controller.create({
					label: `Concurrent ${i}`,
					targetUrl: `https://example.com/${i}`,
				}),
			);
			const results = await Promise.all(promises);
			const ids = new Set(results.map((r) => r.id));
			expect(ids.size).toBe(10);
		});
	});
});
