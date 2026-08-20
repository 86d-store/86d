import { describe, expect, it, vi } from "vitest";
import { createServiceAreaEndpoint } from "../admin/endpoints/create-service-area";
import { deleteServiceAreaEndpoint } from "../admin/endpoints/delete-service-area";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listDeliveries } from "../admin/endpoints/list-deliveries";
import { listQuotes } from "../admin/endpoints/list-quotes";
import { listServiceAreasEndpoint } from "../admin/endpoints/list-service-areas";
import { getDeliveryStats } from "../admin/endpoints/stats";
import { updateDeliveryStatus } from "../admin/endpoints/update-delivery-status";
import { updateServiceAreaEndpoint } from "../admin/endpoints/update-service-area";
import type {
	Delivery,
	DeliveryStats,
	Quote,
	ServiceArea,
	UberDirectController,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeDelivery(overrides: Partial<Delivery> = {}): Delivery {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		orderId: "order_1",
		status: "pending",
		pickupAddress: { street: "123 Main St" },
		dropoffAddress: { street: "456 Oak Ave" },
		fee: 599,
		tip: 0,
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeQuote(overrides: Partial<Quote> = {}): Quote {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		pickupAddress: { street: "123 Main St" },
		dropoffAddress: { street: "456 Oak Ave" },
		fee: 499,
		estimatedMinutes: 30,
		expiresAt: new Date(Date.now() + 3600_000),
		status: "active",
		createdAt: now,
		...overrides,
	};
}

function makeServiceArea(overrides: Partial<ServiceArea> = {}): ServiceArea {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Downtown",
		isActive: true,
		radius: 5,
		centerLat: 37.7749,
		centerLng: -122.4194,
		deliveryFee: 499,
		estimatedMinutes: 30,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeDeliveryStats(
	overrides: Partial<DeliveryStats> = {},
): DeliveryStats {
	return {
		totalDeliveries: 0,
		totalPending: 0,
		totalAccepted: 0,
		totalPickedUp: 0,
		totalDelivered: 0,
		totalCancelled: 0,
		totalFailed: 0,
		totalFees: 0,
		totalTips: 0,
		...overrides,
	};
}

function makeController(
	overrides: Partial<UberDirectController> = {},
): UberDirectController {
	return {
		requestQuote: vi.fn().mockResolvedValue(makeQuote()),
		createDelivery: vi.fn().mockResolvedValue(makeDelivery()),
		getDelivery: vi.fn().mockResolvedValue(null),
		cancelDelivery: vi.fn().mockResolvedValue(null),
		updateDeliveryStatus: vi.fn().mockResolvedValue(null),
		listDeliveries: vi.fn().mockResolvedValue([]),
		getQuote: vi.fn().mockResolvedValue(null),
		listQuotes: vi.fn().mockResolvedValue([]),
		getDeliveryStats: vi.fn().mockResolvedValue(makeDeliveryStats()),
		checkAvailability: vi.fn().mockResolvedValue(false),
		createServiceArea: vi.fn().mockResolvedValue(makeServiceArea()),
		updateServiceArea: vi.fn().mockResolvedValue(null),
		deleteServiceArea: vi.fn().mockResolvedValue(false),
		listServiceAreas: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: UberDirectController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { uberDirect: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const createServiceAreaHandler = extractHandler(createServiceAreaEndpoint);
const deleteServiceAreaHandler = extractHandler(deleteServiceAreaEndpoint);
const settingsHandler = extractHandler(createGetSettingsEndpoint({}));
const listDeliveriesHandler = extractHandler(listDeliveries);
const listQuotesHandler = extractHandler(listQuotes);
const listServiceAreasHandler = extractHandler(listServiceAreasEndpoint);
const deliveryStatsHandler = extractHandler(getDeliveryStats);
const updateDeliveryStatusHandler = extractHandler(updateDeliveryStatus);
const updateServiceAreaHandler = extractHandler(updateServiceAreaEndpoint);

// ── admin POST /uber-direct/service-areas/create ──────────────────────────────

describe("admin POST /uber-direct/service-areas/create", () => {
	it("creates a service area and returns it", async () => {
		const area = makeServiceArea({ name: "East Side" });
		const ctrl = makeController({
			createServiceArea: vi.fn().mockResolvedValue(area),
		});
		const result = (await call(createServiceAreaHandler, {
			body: {
				name: "East Side",
				radius: 3,
				centerLat: 37.78,
				centerLng: -122.41,
				deliveryFee: 399,
				estimatedMinutes: 20,
			},
			controller: ctrl,
		})) as { area: ServiceArea };
		expect(result.area.name).toBe("East Side");
		expect(ctrl.createServiceArea).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "East Side",
				radius: 3,
				deliveryFee: 399,
				estimatedMinutes: 20,
			}),
		);
	});

	it("forwards all fields to controller", async () => {
		const ctrl = makeController();
		await call(createServiceAreaHandler, {
			body: {
				name: "North Zone",
				radius: 8,
				centerLat: 37.82,
				centerLng: -122.43,
				deliveryFee: 599,
				estimatedMinutes: 45,
			},
			controller: ctrl,
		});
		expect(ctrl.createServiceArea).toHaveBeenCalledWith(
			expect.objectContaining({
				centerLat: 37.82,
				centerLng: -122.43,
			}),
		);
	});
});

// ── admin POST /uber-direct/service-areas/:id/delete ──────────────────────────

describe("admin POST /uber-direct/service-areas/:id/delete", () => {
	it("returns 404 when service area not found", async () => {
		const result = (await call(deleteServiceAreaHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Service area not found");
	});

	it("deletes service area and returns success", async () => {
		const ctrl = makeController({
			deleteServiceArea: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteServiceAreaHandler, {
			params: { id: "area_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteServiceArea).toHaveBeenCalledWith("area_1");
	});
});

// ── admin GET /uber-direct/settings ──────────────────────────────────────────

describe("admin GET /uber-direct/settings", () => {
	it("returns not_configured status when no credentials provided", async () => {
		const result = (await call(settingsHandler)) as {
			status: string;
			configured: boolean;
		};
		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it("returns masked fields as null when not configured", async () => {
		const result = (await call(settingsHandler)) as {
			clientIdMasked: string | null;
			customerIdMasked: string | null;
		};
		expect(result.clientIdMasked).toBeNull();
		expect(result.customerIdMasked).toBeNull();
	});
});

// ── admin GET /uber-direct/deliveries ────────────────────────────────────────

describe("admin GET /uber-direct/deliveries", () => {
	it("returns empty deliveries list and zero total", async () => {
		const result = (await call(listDeliveriesHandler)) as {
			deliveries: Delivery[];
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
		})) as { deliveries: Delivery[]; total: number };
		expect(result.deliveries).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("passes status filter to controller", async () => {
		const ctrl = makeController();
		await call(listDeliveriesHandler, {
			query: { status: "pending" },
			controller: ctrl,
		});
		expect(ctrl.listDeliveries).toHaveBeenCalledWith(
			expect.objectContaining({ status: "pending" }),
		);
	});
});

// ── admin GET /uber-direct/quotes ─────────────────────────────────────────────

describe("admin GET /uber-direct/quotes", () => {
	it("returns empty quotes list and zero total", async () => {
		const result = (await call(listQuotesHandler)) as {
			quotes: Quote[];
			total: number;
		};
		expect(result.quotes).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns quotes from controller", async () => {
		const quotes = [makeQuote(), makeQuote()];
		const ctrl = makeController({
			listQuotes: vi.fn().mockResolvedValue(quotes),
		});
		const result = (await call(listQuotesHandler, {
			controller: ctrl,
		})) as { quotes: Quote[]; total: number };
		expect(result.quotes).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

// ── admin GET /uber-direct/service-areas ──────────────────────────────────────

describe("admin GET /uber-direct/service-areas", () => {
	it("returns empty list when no areas", async () => {
		const result = (await call(listServiceAreasHandler)) as {
			areas: ServiceArea[];
		};
		expect(result.areas).toHaveLength(0);
	});

	it("returns service areas from controller", async () => {
		const areas = [makeServiceArea(), makeServiceArea()];
		const ctrl = makeController({
			listServiceAreas: vi.fn().mockResolvedValue(areas),
		});
		const result = (await call(listServiceAreasHandler, {
			controller: ctrl,
		})) as { areas: ServiceArea[] };
		expect(result.areas).toHaveLength(2);
	});

	it("passes isActive filter to controller", async () => {
		const ctrl = makeController();
		await call(listServiceAreasHandler, {
			query: { isActive: "true" },
			controller: ctrl,
		});
		expect(ctrl.listServiceAreas).toHaveBeenCalledWith(
			expect.objectContaining({ isActive: true }),
		);
	});
});

// ── admin GET /uber-direct/stats ──────────────────────────────────────────────

describe("admin GET /uber-direct/stats", () => {
	it("returns delivery stats from controller", async () => {
		const stats = makeDeliveryStats({
			totalDeliveries: 100,
			totalDelivered: 85,
			totalFees: 50000,
		});
		const ctrl = makeController({
			getDeliveryStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(deliveryStatsHandler, {
			controller: ctrl,
		})) as { stats: DeliveryStats };
		expect(result.stats.totalDeliveries).toBe(100);
		expect(result.stats.totalDelivered).toBe(85);
		expect(result.stats.totalFees).toBe(50000);
	});

	it("returns zero-state stats when empty", async () => {
		const result = (await call(deliveryStatsHandler)) as {
			stats: DeliveryStats;
		};
		expect(result.stats.totalDeliveries).toBe(0);
		expect(result.stats.totalFees).toBe(0);
	});
});

// ── admin PUT /uber-direct/deliveries/:id/status ──────────────────────────────

describe("admin PUT /uber-direct/deliveries/:id/status", () => {
	it("returns 404 when delivery not found", async () => {
		const result = (await call(updateDeliveryStatusHandler, {
			params: { id: "missing" },
			body: { status: "delivered" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Delivery not found");
	});

	it("returns updated delivery on success", async () => {
		const delivery = makeDelivery({ id: "del_1", status: "delivered" });
		const ctrl = makeController({
			updateDeliveryStatus: vi.fn().mockResolvedValue(delivery),
		});
		const result = (await call(updateDeliveryStatusHandler, {
			params: { id: "del_1" },
			body: { status: "delivered" },
			controller: ctrl,
		})) as { delivery: Delivery };
		expect(result.delivery.status).toBe("delivered");
		expect(ctrl.updateDeliveryStatus).toHaveBeenCalledWith(
			"del_1",
			"delivered",
			expect.any(Object),
		);
	});

	it("forwards optional courier fields to controller", async () => {
		const delivery = makeDelivery({ id: "del_2", status: "picked-up" });
		const ctrl = makeController({
			updateDeliveryStatus: vi.fn().mockResolvedValue(delivery),
		});
		await call(updateDeliveryStatusHandler, {
			params: { id: "del_2" },
			body: {
				status: "picked-up",
				courierName: "John Doe",
				courierPhone: "+15551234567",
			},
			controller: ctrl,
		});
		expect(ctrl.updateDeliveryStatus).toHaveBeenCalledWith(
			"del_2",
			"picked-up",
			expect.objectContaining({
				courierName: "John Doe",
				courierPhone: "+15551234567",
			}),
		);
	});
});

// ── admin PATCH /uber-direct/service-areas/:id ───────────────────────────────

describe("admin PATCH /uber-direct/service-areas/:id", () => {
	it("returns 404 when service area not found", async () => {
		const result = (await call(updateServiceAreaHandler, {
			params: { id: "missing" },
			body: { name: "Updated" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Service area not found");
	});

	it("returns updated service area on success", async () => {
		const area = makeServiceArea({ id: "area_2", name: "Updated Zone" });
		const ctrl = makeController({
			updateServiceArea: vi.fn().mockResolvedValue(area),
		});
		const result = (await call(updateServiceAreaHandler, {
			params: { id: "area_2" },
			body: { name: "Updated Zone" },
			controller: ctrl,
		})) as { area: ServiceArea };
		expect(result.area.name).toBe("Updated Zone");
		expect(ctrl.updateServiceArea).toHaveBeenCalledWith(
			"area_2",
			expect.objectContaining({ name: "Updated Zone" }),
		);
	});
});
