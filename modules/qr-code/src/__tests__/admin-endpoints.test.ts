import { describe, expect, it, vi } from "vitest";
import { createBatchEndpoint } from "../admin/endpoints/create-batch";
import { createQrCodeEndpoint } from "../admin/endpoints/create-qr-code";
import { deleteQrCodeEndpoint } from "../admin/endpoints/delete-qr-code";
import { getQrCodeEndpoint } from "../admin/endpoints/get-qr-code";
import { listQrCodesEndpoint } from "../admin/endpoints/list-qr-codes";
import { listScansEndpoint } from "../admin/endpoints/list-scans";
import { updateQrCodeEndpoint } from "../admin/endpoints/update-qr-code";
import type { QrCode, QrCodeController, QrScan } from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeQrCode(overrides: Partial<QrCode> = {}): QrCode {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		label: "Product Page",
		targetUrl: "https://example.com/products/widget",
		targetType: "product",
		format: "svg",
		size: 256,
		errorCorrection: "M",
		scanCount: 0,
		isActive: true,
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeScan(overrides: Partial<QrScan> = {}): QrScan {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		qrCodeId: "qr-1",
		scannedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<QrCodeController> = {},
): QrCodeController {
	return {
		create: vi.fn().mockResolvedValue(makeQrCode()),
		get: vi.fn().mockResolvedValue(null),
		getByTarget: vi.fn().mockResolvedValue(null),
		update: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(false),
		list: vi.fn().mockResolvedValue([]),
		recordScan: vi.fn().mockResolvedValue(makeScan()),
		getScanCount: vi.fn().mockResolvedValue(0),
		listScans: vi.fn().mockResolvedValue([]),
		createBatch: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: QrCodeController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { qrCode: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listHandler = extractHandler(listQrCodesEndpoint);
const createHandler = extractHandler(createQrCodeEndpoint);
const createBatchHandler = extractHandler(createBatchEndpoint);
const getHandler = extractHandler(getQrCodeEndpoint);
const updateHandler = extractHandler(updateQrCodeEndpoint);
const deleteHandler = extractHandler(deleteQrCodeEndpoint);
const listScansHandler = extractHandler(listScansEndpoint);

// ── admin GET /qr-codes ───────────────────────────────────────────────────────

describe("admin GET /qr-codes", () => {
	it("returns empty list and total=0", async () => {
		const result = (await call(listHandler)) as {
			qrCodes: QrCode[];
			total: number;
		};
		expect(result.qrCodes).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns qr codes and their count", async () => {
		const codes = [makeQrCode(), makeQrCode()];
		const ctrl = makeController({ list: vi.fn().mockResolvedValue(codes) });
		const result = (await call(listHandler, { controller: ctrl })) as {
			qrCodes: QrCode[];
			total: number;
		};
		expect(result.qrCodes).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

// ── admin POST /qr-codes/create ───────────────────────────────────────────────

describe("admin POST /qr-codes/create", () => {
	it("creates a qr code and returns it", async () => {
		const code = makeQrCode({ label: "Home Page" });
		const ctrl = makeController({ create: vi.fn().mockResolvedValue(code) });
		const result = (await call(createHandler, {
			body: {
				label: "Home Page",
				targetUrl: "https://example.com",
			},
			controller: ctrl,
		})) as { qrCode: QrCode };
		expect(result.qrCode.label).toBe("Home Page");
	});

	it("calls controller with body fields", async () => {
		const ctrl = makeController();
		await call(createHandler, {
			body: {
				label: "Promo",
				targetUrl: "https://example.com/promo",
				targetType: "page",
				format: "png",
				size: 512,
			},
			controller: ctrl,
		});
		expect(ctrl.create).toHaveBeenCalledWith(
			expect.objectContaining({
				label: "Promo",
				targetType: "page",
				format: "png",
				size: 512,
			}),
		);
	});
});

// ── admin POST /qr-codes/batch ────────────────────────────────────────────────

describe("admin POST /qr-codes/batch", () => {
	it("returns empty batch", async () => {
		const result = (await call(createBatchHandler, {
			body: {
				items: [
					{
						label: "Item 1",
						targetUrl: "https://example.com/1",
					},
				],
			},
		})) as { qrCodes: QrCode[]; count: number };
		expect(result.qrCodes).toHaveLength(0);
		expect(result.count).toBe(0);
	});

	it("creates multiple qr codes and returns count", async () => {
		const codes = [makeQrCode(), makeQrCode(), makeQrCode()];
		const ctrl = makeController({
			createBatch: vi.fn().mockResolvedValue(codes),
		});
		const result = (await call(createBatchHandler, {
			body: {
				items: [
					{ label: "A", targetUrl: "https://example.com/a" },
					{ label: "B", targetUrl: "https://example.com/b" },
					{ label: "C", targetUrl: "https://example.com/c" },
				],
			},
			controller: ctrl,
		})) as { qrCodes: QrCode[]; count: number };
		expect(result.qrCodes).toHaveLength(3);
		expect(result.count).toBe(3);
	});
});

// ── admin GET /qr-codes/:id ───────────────────────────────────────────────────

describe("admin GET /qr-codes/:id", () => {
	it("returns null when qr code not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { qrCode: QrCode | null };
		expect(result.qrCode).toBeNull();
	});

	it("returns qr code when found", async () => {
		const code = makeQrCode({ id: "qr-5", label: "Checkout" });
		const ctrl = makeController({ get: vi.fn().mockResolvedValue(code) });
		const result = (await call(getHandler, {
			params: { id: "qr-5" },
			controller: ctrl,
		})) as { qrCode: QrCode };
		expect(result.qrCode.id).toBe("qr-5");
		expect(result.qrCode.label).toBe("Checkout");
	});
});

// ── admin PUT /qr-codes/:id/update ────────────────────────────────────────────

describe("admin PUT /qr-codes/:id/update", () => {
	it("returns qrCode=null and error when not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { label: "New" },
		})) as { qrCode: null; error: string };
		expect(result.qrCode).toBeNull();
		expect(result.error).toBe("QR code not found");
	});

	it("returns updated qr code on success", async () => {
		const code = makeQrCode({ id: "qr-6", label: "Updated Label" });
		const ctrl = makeController({ update: vi.fn().mockResolvedValue(code) });
		const result = (await call(updateHandler, {
			params: { id: "qr-6" },
			body: { label: "Updated Label" },
			controller: ctrl,
		})) as { qrCode: QrCode };
		expect(result.qrCode.label).toBe("Updated Label");
	});
});

// ── admin DELETE /qr-codes/:id/delete ────────────────────────────────────────

describe("admin DELETE /qr-codes/:id/delete", () => {
	it("returns deleted=false when not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted=true on success", async () => {
		const ctrl = makeController({ delete: vi.fn().mockResolvedValue(true) });
		const result = (await call(deleteHandler, {
			params: { id: "qr-7" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.delete).toHaveBeenCalledWith("qr-7");
	});
});

// ── admin GET /qr-codes/:id/scans ─────────────────────────────────────────────

describe("admin GET /qr-codes/:id/scans", () => {
	it("returns empty scans list and total=0", async () => {
		const result = (await call(listScansHandler, {
			params: { id: "qr-1" },
		})) as { scans: QrScan[]; total: number };
		expect(result.scans).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns scans for the qr code", async () => {
		const scans = [
			makeScan({ qrCodeId: "qr-8" }),
			makeScan({ qrCodeId: "qr-8" }),
		];
		const ctrl = makeController({
			listScans: vi.fn().mockResolvedValue(scans),
		});
		const result = (await call(listScansHandler, {
			params: { id: "qr-8" },
			controller: ctrl,
		})) as { scans: QrScan[]; total: number };
		expect(result.scans).toHaveLength(2);
		expect(result.total).toBe(2);
		expect(ctrl.listScans).toHaveBeenCalledWith("qr-8", expect.any(Object));
	});
});
