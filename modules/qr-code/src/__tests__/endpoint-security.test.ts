import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createQrCodeController } from "../service-impl";

/**
 * Security tests for QR code module endpoints.
 *
 * These tests verify:
 * - QR code CRUD operations work correctly via the controller
 * - Inactive QR codes are properly handled
 * - Scan recording is scoped correctly
 * - Batch creation validates correctly
 * - Non-existent resources return proper null/false responses
 */

describe("qr-code endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createQrCodeController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createQrCodeController(mockData);
	});

	// ── QR Code CRUD Safety ──────────────────────────────────────────

	describe("QR code CRUD safety", () => {
		it("get returns null for non-existent QR code", async () => {
			const result = await controller.get("nonexistent");
			expect(result).toBeNull();
		});

		it("update returns null for non-existent QR code", async () => {
			const result = await controller.update("nonexistent", {
				label: "Nope",
			});
			expect(result).toBeNull();
		});

		it("delete returns false for non-existent QR code", async () => {
			const result = await controller.delete("nonexistent");
			expect(result).toBe(false);
		});

		it("deleted QR code cannot be retrieved", async () => {
			const qr = await controller.create({
				label: "Temporary",
				targetUrl: "https://example.com",
			});
			await controller.delete(qr.id);

			const result = await controller.get(qr.id);
			expect(result).toBeNull();
		});

		it("deleted QR code cannot be updated", async () => {
			const qr = await controller.create({
				label: "Temporary",
				targetUrl: "https://example.com",
			});
			await controller.delete(qr.id);

			const result = await controller.update(qr.id, { label: "Changed" });
			expect(result).toBeNull();
		});
	});

	// ── Active State Handling ────────────────────────────────────────

	describe("active state handling", () => {
		it("deactivating a QR code preserves data", async () => {
			const qr = await controller.create({
				label: "Deactivate Me",
				targetUrl: "https://example.com",
				targetType: "product",
				targetId: "prod-1",
			});

			const updated = await controller.update(qr.id, { isActive: false });
			expect(updated?.isActive).toBe(false);
			expect(updated?.label).toBe("Deactivate Me");
			expect(updated?.targetType).toBe("product");
		});

		it("reactivating a QR code works", async () => {
			const qr = await controller.create({
				label: "Toggle",
				targetUrl: "https://example.com",
			});

			await controller.update(qr.id, { isActive: false });
			const reactivated = await controller.update(qr.id, { isActive: true });
			expect(reactivated?.isActive).toBe(true);
		});

		it("list with isActive filter returns correct subset", async () => {
			await controller.create({
				label: "Active",
				targetUrl: "https://example.com/active",
			});
			const inactive = await controller.create({
				label: "Inactive",
				targetUrl: "https://example.com/inactive",
			});
			await controller.update(inactive.id, { isActive: false });

			const activeOnly = await controller.list({ isActive: true });
			expect(activeOnly).toHaveLength(1);
			expect(activeOnly[0].label).toBe("Active");

			const inactiveOnly = await controller.list({ isActive: false });
			expect(inactiveOnly).toHaveLength(1);
			expect(inactiveOnly[0].label).toBe("Inactive");
		});
	});

	// ── Scan Recording Safety ────────────────────────────────────────

	describe("scan recording safety", () => {
		it("scan on non-existent QR code returns null", async () => {
			const result = await controller.recordScan("nonexistent");
			expect(result).toBeNull();
		});

		it("scan records are scoped to the correct QR code", async () => {
			const qr1 = await controller.create({
				label: "QR 1",
				targetUrl: "https://example.com/1",
			});
			const qr2 = await controller.create({
				label: "QR 2",
				targetUrl: "https://example.com/2",
			});

			await controller.recordScan(qr1.id);
			await controller.recordScan(qr1.id);
			await controller.recordScan(qr2.id);

			const scans1 = await controller.listScans(qr1.id);
			const scans2 = await controller.listScans(qr2.id);
			expect(scans1).toHaveLength(2);
			expect(scans2).toHaveLength(1);
		});

		it("scan count reflects actual scans", async () => {
			const qr = await controller.create({
				label: "Counted",
				targetUrl: "https://example.com",
			});

			await controller.recordScan(qr.id);
			await controller.recordScan(qr.id);
			await controller.recordScan(qr.id);

			const count = await controller.getScanCount(qr.id);
			expect(count).toBe(3);

			const updated = await controller.get(qr.id);
			expect(updated?.scanCount).toBe(3);
		});
	});

	// ── Batch Creation Safety ────────────────────────────────────────

	describe("batch creation safety", () => {
		it("batch creates all items", async () => {
			const results = await controller.createBatch([
				{ label: "B1", targetUrl: "https://example.com/1" },
				{ label: "B2", targetUrl: "https://example.com/2" },
			]);

			expect(results).toHaveLength(2);

			const all = await controller.list();
			expect(all).toHaveLength(2);
		});

		it("batch items have unique IDs", async () => {
			const results = await controller.createBatch([
				{ label: "B1", targetUrl: "https://example.com/1" },
				{ label: "B2", targetUrl: "https://example.com/2" },
				{ label: "B3", targetUrl: "https://example.com/3" },
			]);

			const ids = new Set(results.map((r) => r.id));
			expect(ids.size).toBe(3);
		});
	});

	// ── Target Lookup Safety ─────────────────────────────────────────

	describe("target lookup safety", () => {
		it("getByTarget returns null for non-matching type", async () => {
			await controller.create({
				label: "Product QR",
				targetUrl: "https://example.com",
				targetType: "product",
				targetId: "prod-1",
			});

			const result = await controller.getByTarget("page", "prod-1");
			expect(result).toBeNull();
		});

		it("getByTarget returns null for non-matching ID", async () => {
			await controller.create({
				label: "Product QR",
				targetUrl: "https://example.com",
				targetType: "product",
				targetId: "prod-1",
			});

			const result = await controller.getByTarget("product", "prod-999");
			expect(result).toBeNull();
		});
	});
});
