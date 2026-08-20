import { describe, expect, it, vi } from "vitest";
import { createServiceArea } from "../admin/endpoints/create-service-area";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listDeliveries } from "../admin/endpoints/list-deliveries";
import { listServiceAreas } from "../admin/endpoints/list-service-areas";
import { getFavorStats } from "../admin/endpoints/stats";
import { updateDeliveryStatus } from "../admin/endpoints/update-delivery-status";
import type {
	FavorController,
	FavorDelivery,
	FavorDeliveryStats,
	ServiceArea,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeDelivery(overrides: Partial<FavorDelivery> = {}): FavorDelivery {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		orderId: "order_1",
		status: "pending",
		pickupAddress: { street: "123 Main St", city: "Austin", state: "TX" },
		dropoffAddress: { street: "456 Oak Ave", city: "Austin", state: "TX" },
		fee: 699,
		tip: 150,
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeServiceArea(overrides: Partial<ServiceArea> = {}): ServiceArea {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Downtown Austin",
		isActive: true,
		zipCodes: ["78701", "78702"],
		minOrderAmount: 1500,
		deliveryFee: 699,
		estimatedMinutes: 45,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeDeliveryStats(
	overrides: Partial<FavorDeliveryStats> = {},
): FavorDeliveryStats {
	return {
		totalDeliveries: 10,
		totalPending: 2,
		totalAssigned: 1,
		totalEnRoute: 1,
		totalCompleted: 5,
		totalCancelled: 1,
		totalFees: 6990,
		totalTips: 1500,
		...overrides,
	};
}

function makeController(
	overrides: Partial<FavorController> = {},
): FavorController {
	return {
		createDelivery: vi.fn().mockResolvedValue(makeDelivery()),
		getDelivery: vi.fn().mockResolvedValue(null),
		cancelDelivery: vi.fn().mockResolvedValue(null),
		updateDeliveryStatus: vi.fn().mockResolvedValue(null),
		listDeliveries: vi.fn().mockResolvedValue([]),
		createServiceArea: vi.fn().mockResolvedValue(makeServiceArea()),
		updateServiceArea: vi.fn().mockResolvedValue(null),
		deleteServiceArea: vi.fn().mockResolvedValue(false),
		listServiceAreas: vi.fn().mockResolvedValue([]),
		checkAvailability: vi
			.fn()
			.mockResolvedValue({ available: false, area: null }),
		getDeliveryStats: vi.fn().mockResolvedValue(makeDeliveryStats()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: FavorController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { favor: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listDeliveriesHandler = extractHandler(listDeliveries);
const createServiceAreaHandler = extractHandler(createServiceArea);
const listServiceAreasHandler = extractHandler(listServiceAreas);
const statsHandler = extractHandler(getFavorStats);
const updateDeliveryStatusHandler = extractHandler(updateDeliveryStatus);

function callSettings(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
) {
	return handler({ query: {}, params: {}, body: {}, context: {} });
}

// ── GET /admin/favor/deliveries ───────────────────────────────────────────────

describe("admin GET /favor/deliveries", () => {
	it("returns empty list when no deliveries", async () => {
		const result = (await call(listDeliveriesHandler)) as {
			deliveries: FavorDelivery[];
			total: number;
		};
		expect(result.deliveries).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns deliveries from controller", async () => {
		const deliveries = [makeDelivery(), makeDelivery()];
		const ctrl = makeController({
			listDeliveries: vi.fn().mockResolvedValue(deliveries),
		});
		const result = (await call(listDeliveriesHandler, {
			controller: ctrl,
		})) as { deliveries: FavorDelivery[]; total: number };
		expect(result.deliveries).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards status and orderId filters to controller", async () => {
		const ctrl = makeController();
		await call(listDeliveriesHandler, {
			query: { status: "pending", orderId: "order_1" },
			controller: ctrl,
		});
		expect(ctrl.listDeliveries).toHaveBeenCalledWith(
			expect.objectContaining({ status: "pending", orderId: "order_1" }),
		);
	});
});

// ── PUT /admin/favor/deliveries/:id/status ───────────────────────────────────

describe("admin PUT /favor/deliveries/:id/status", () => {
	it("returns 404 error when delivery not found", async () => {
		const result = (await call(updateDeliveryStatusHandler, {
			params: { id: "missing" },
			body: { status: "assigned" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Delivery not found");
		expect(result.status).toBe(404);
	});

	it("updates delivery status and returns updated delivery", async () => {
		const delivery = makeDelivery({ id: "del_1", status: "assigned" });
		const ctrl = makeController({
			updateDeliveryStatus: vi.fn().mockResolvedValue(delivery),
		});
		const result = (await call(updateDeliveryStatusHandler, {
			params: { id: "del_1" },
			body: {
				status: "assigned",
				runnerName: "John Runner",
				runnerPhone: "512-555-1234",
			},
			controller: ctrl,
		})) as { delivery: FavorDelivery };
		expect(result.delivery.status).toBe("assigned");
		expect(ctrl.updateDeliveryStatus).toHaveBeenCalledWith(
			"del_1",
			"assigned",
			expect.objectContaining({ runnerName: "John Runner" }),
		);
	});

	it("updates delivery with tracking url", async () => {
		const delivery = makeDelivery({
			id: "del_1",
			status: "en-route",
			trackingUrl: "https://track.example.com/del_1",
		});
		const ctrl = makeController({
			updateDeliveryStatus: vi.fn().mockResolvedValue(delivery),
		});
		const result = (await call(updateDeliveryStatusHandler, {
			params: { id: "del_1" },
			body: {
				status: "en-route",
				trackingUrl: "https://track.example.com/del_1",
			},
			controller: ctrl,
		})) as { delivery: FavorDelivery };
		expect(result.delivery.trackingUrl).toBe("https://track.example.com/del_1");
	});
});

// ── POST /admin/favor/service-areas/create ───────────────────────────────────

describe("admin POST /favor/service-areas/create", () => {
	it("creates a service area and returns it", async () => {
		const area = makeServiceArea({ name: "East Austin" });
		const ctrl = makeController({
			createServiceArea: vi.fn().mockResolvedValue(area),
		});
		const result = (await call(createServiceAreaHandler, {
			body: {
				name: "East Austin",
				zipCodes: ["78702", "78703"],
				deliveryFee: 599,
				estimatedMinutes: 40,
			},
			controller: ctrl,
		})) as { area: ServiceArea };
		expect(result.area.name).toBe("East Austin");
		expect(ctrl.createServiceArea).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "East Austin",
				zipCodes: ["78702", "78703"],
				deliveryFee: 599,
			}),
		);
	});

	it("forwards minOrderAmount to controller", async () => {
		const ctrl = makeController();
		await call(createServiceAreaHandler, {
			body: {
				name: "South Austin",
				zipCodes: ["78704"],
				deliveryFee: 799,
				estimatedMinutes: 50,
				minOrderAmount: 2000,
			},
			controller: ctrl,
		});
		expect(ctrl.createServiceArea).toHaveBeenCalledWith(
			expect.objectContaining({ minOrderAmount: 2000 }),
		);
	});
});

// ── GET /admin/favor/service-areas ───────────────────────────────────────────

describe("admin GET /favor/service-areas", () => {
	it("returns empty list when no service areas", async () => {
		const result = (await call(listServiceAreasHandler)) as {
			areas: ServiceArea[];
			total: number;
		};
		expect(result.areas).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns service areas from controller", async () => {
		const areas = [
			makeServiceArea(),
			makeServiceArea({ name: "North Austin" }),
		];
		const ctrl = makeController({
			listServiceAreas: vi.fn().mockResolvedValue(areas),
		});
		const result = (await call(listServiceAreasHandler, {
			controller: ctrl,
		})) as { areas: ServiceArea[]; total: number };
		expect(result.areas).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

// ── GET /admin/favor/stats ────────────────────────────────────────────────────

describe("admin GET /favor/stats", () => {
	it("returns delivery stats", async () => {
		const stats = makeDeliveryStats({ totalDeliveries: 10, totalCompleted: 8 });
		const ctrl = makeController({
			getDeliveryStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: FavorDeliveryStats };
		expect(result.stats.totalDeliveries).toBe(10);
		expect(result.stats.totalCompleted).toBe(8);
	});
});

// ── GET /admin/favor/settings ─────────────────────────────────────────────────

describe("admin GET /favor/settings", () => {
	it("returns not_configured when no credentials", async () => {
		const ep = createGetSettingsEndpoint({});
		const handler = extractHandler(ep);
		const result = (await callSettings(handler)) as {
			status: string;
			configured: boolean;
			apiKeyMasked: string | null;
			merchantIdMasked: string | null;
			sandbox: boolean;
		};
		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.apiKeyMasked).toBeNull();
		expect(result.merchantIdMasked).toBeNull();
		expect(result.sandbox).toBe(true);
	});

	it("returns not_configured when only apiKey provided", async () => {
		const ep = createGetSettingsEndpoint({ apiKey: "sk_test_abc123" });
		const handler = extractHandler(ep);
		const result = (await callSettings(handler)) as { status: string };
		expect(result.status).toBe("not_configured");
	});

	it("returns configured when apiKey and merchantId provided", async () => {
		const ep = createGetSettingsEndpoint({
			apiKey: "sk_test_abc123xyz",
			merchantId: "merchant_99",
		});
		const handler = extractHandler(ep);
		const result = (await callSettings(handler)) as {
			status: string;
			configured: boolean;
			apiKeyMasked: string | null;
			merchantIdMasked: string | null;
			sandbox: boolean;
		};
		expect(result.status).toBe("configured");
		expect(result.configured).toBe(true);
		expect(result.apiKeyMasked).toMatch(/\*/);
		expect(result.merchantIdMasked).toMatch(/\*/);
		expect(result.sandbox).toBe(true);
	});

	it("reflects sandbox: false when passed", async () => {
		const ep = createGetSettingsEndpoint({
			apiKey: "sk_live_abc123xyz",
			merchantId: "merchant_99",
			sandbox: false,
		});
		const handler = extractHandler(ep);
		const result = (await callSettings(handler)) as { sandbox: boolean };
		expect(result.sandbox).toBe(false);
	});

	it("masks apiKey preserving first 8 chars", async () => {
		const ep = createGetSettingsEndpoint({
			apiKey: "sk_test_abc123xyz",
			merchantId: "merchant_99",
		});
		const handler = extractHandler(ep);
		const result = (await callSettings(handler)) as { apiKeyMasked: string };
		expect(result.apiKeyMasked?.startsWith("sk_test_")).toBe(true);
		expect(result.apiKeyMasked).toContain("*");
	});

	it("masks short apiKey entirely", async () => {
		const ep = createGetSettingsEndpoint({
			apiKey: "abc",
			merchantId: "merchant_99",
		});
		const handler = extractHandler(ep);
		const result = (await callSettings(handler)) as { apiKeyMasked: string };
		expect(result.apiKeyMasked).toBe("****");
	});
});
