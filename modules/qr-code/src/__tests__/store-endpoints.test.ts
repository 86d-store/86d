import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createQrCodeController } from "../service-impl";

/**
 * Store endpoint integration tests for the qr-code module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-by-target: resolves QR code by target type and ID
 * 2. record-scan: records a scan event
 * 3. get-scan-count: returns scan count for a QR code
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

type QrCodeTargetType = "product" | "collection" | "page" | "order" | "custom";

async function simulateGetByTarget(
	data: DataService,
	targetType: QrCodeTargetType,
	targetId: string,
) {
	const controller = createQrCodeController(data);
	const qrCode = await controller.getByTarget(targetType, targetId);
	if (!qrCode) {
		return { error: "QR code not found", status: 404 };
	}
	return { qrCode };
}

async function simulateRecordScan(
	data: DataService,
	id: string,
	body: { userAgent?: string; ipAddress?: string } = {},
) {
	const controller = createQrCodeController(data);
	const scan = await controller.recordScan(id, body);
	if (!scan) {
		return { error: "QR code not found", status: 404 };
	}
	return { scan };
}

async function simulateGetScanCount(data: DataService, id: string) {
	const controller = createQrCodeController(data);
	const count = await controller.getScanCount(id);
	return { count };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: get by target — resolve QR code", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns QR code for matching target", async () => {
		const ctrl = createQrCodeController(data);
		await ctrl.create({
			label: "Product QR",
			targetUrl: "https://store.example.com/products/widget",
			targetType: "product",
			targetId: "prod_1",
		});

		const result = await simulateGetByTarget(data, "product", "prod_1");

		expect("qrCode" in result).toBe(true);
		if ("qrCode" in result) {
			expect(result.qrCode.label).toBe("Product QR");
			expect(result.qrCode.targetType).toBe("product");
		}
	});

	it("returns 404 for nonexistent target", async () => {
		const result = await simulateGetByTarget(data, "product", "ghost");

		expect(result).toEqual({ error: "QR code not found", status: 404 });
	});
});

describe("store endpoint: record scan", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("records a scan event", async () => {
		const ctrl = createQrCodeController(data);
		const qr = await ctrl.create({
			label: "Menu QR",
			targetUrl: "https://store.example.com/menu",
			targetType: "page",
			targetId: "menu_1",
		});

		const result = await simulateRecordScan(data, qr.id, {
			userAgent: "Mozilla/5.0",
		});

		expect("scan" in result).toBe(true);
		if ("scan" in result) {
			expect(result.scan.qrCodeId).toBe(qr.id);
		}
	});

	it("returns 404 for nonexistent QR code", async () => {
		const result = await simulateRecordScan(data, "ghost_qr");

		expect(result).toEqual({ error: "QR code not found", status: 404 });
	});
});

describe("store endpoint: get scan count", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns scan count for QR code", async () => {
		const ctrl = createQrCodeController(data);
		const qr = await ctrl.create({
			label: "Flyer QR",
			targetUrl: "https://store.example.com/promo",
			targetType: "custom",
			targetId: "promo_1",
		});
		await ctrl.recordScan(qr.id, {});
		await ctrl.recordScan(qr.id, {});

		const result = await simulateGetScanCount(data, qr.id);

		expect(result.count).toBe(2);
	});

	it("returns zero for QR code with no scans", async () => {
		const ctrl = createQrCodeController(data);
		const qr = await ctrl.create({
			label: "New QR",
			targetUrl: "https://store.example.com/new",
			targetType: "page",
			targetId: "page_1",
		});

		const result = await simulateGetScanCount(data, qr.id);

		expect(result.count).toBe(0);
	});
});
