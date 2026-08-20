import { describe, expect, it, vi } from "vitest";
import { createDeliveryAdminEndpoint } from "../admin/endpoints/create-delivery";
import { createZoneEndpoint } from "../admin/endpoints/create-zone";
import { deleteZoneEndpoint } from "../admin/endpoints/delete-zone";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listDeliveriesEndpoint } from "../admin/endpoints/list-deliveries";
import { listZonesEndpoint } from "../admin/endpoints/list-zones";
import { updateDeliveryStatusEndpoint } from "../admin/endpoints/update-delivery-status";
import { updateZoneEndpoint } from "../admin/endpoints/update-zone";
import type { Delivery, DeliveryZone, DoordashController } from "../service";

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
		pickupAddress: {
			street: "123 Main St",
			city: "San Francisco",
			state: "CA",
			zip: "94105",
		},
		dropoffAddress: {
			street: "456 Market St",
			city: "San Francisco",
			state: "CA",
			zip: "94105",
		},
		fee: 500,
		tip: 100,
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeZone(overrides: Partial<DeliveryZone> = {}): DeliveryZone {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Downtown Zone",
		isActive: true,
		radius: 5,
		centerLat: 37.7749,
		centerLng: -122.4194,
		minOrderAmount: 1500,
		deliveryFee: 500,
		estimatedMinutes: 30,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<DoordashController> = {},
): DoordashController {
	return {
		createDelivery: vi.fn().mockResolvedValue(makeDelivery()),
		getDelivery: vi.fn().mockResolvedValue(null),
		cancelDelivery: vi.fn().mockResolvedValue(null),
		updateDeliveryStatus: vi.fn().mockResolvedValue(null),
		listDeliveries: vi.fn().mockResolvedValue([]),
		requestQuote: vi.fn().mockResolvedValue(null),
		acceptQuote: vi.fn().mockResolvedValue(null),
		createZone: vi.fn().mockResolvedValue(makeZone()),
		updateZone: vi.fn().mockResolvedValue(null),
		deleteZone: vi.fn().mockResolvedValue(false),
		listZones: vi.fn().mockResolvedValue([]),
		checkDeliveryAvailability: vi.fn().mockResolvedValue(false),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: DoordashController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { doordash: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const createDeliveryHandler = extractHandler(createDeliveryAdminEndpoint);
const createZoneHandler = extractHandler(createZoneEndpoint);
const deleteZoneHandler = extractHandler(deleteZoneEndpoint);
const settingsHandler = extractHandler(createGetSettingsEndpoint({}));
const listDeliveriesHandler = extractHandler(listDeliveriesEndpoint);
const listZonesHandler = extractHandler(listZonesEndpoint);
const updateDeliveryStatusHandler = extractHandler(
	updateDeliveryStatusEndpoint,
);
const updateZoneHandler = extractHandler(updateZoneEndpoint);

// ── admin POST /doordash/deliveries ───────────────────────────────────────────

describe("admin POST /doordash/deliveries", () => {
	const pickup = { street: "123 Main St", city: "San Francisco", state: "CA" };
	const dropoff = { street: "456 Oak Ave", city: "San Francisco", state: "CA" };

	it("creates a delivery and returns it", async () => {
		const delivery = makeDelivery({ orderId: "order_99" });
		const ctrl = makeController({
			createDelivery: vi.fn().mockResolvedValue(delivery),
		});
		const result = (await call(createDeliveryHandler, {
			body: {
				orderId: "order_99",
				pickupAddress: pickup,
				dropoffAddress: dropoff,
				fee: 500,
			},
			controller: ctrl,
		})) as { delivery: Delivery };
		expect(result.delivery.orderId).toBe("order_99");
		expect(ctrl.createDelivery).toHaveBeenCalledWith(
			expect.objectContaining({ orderId: "order_99" }),
		);
	});

	it("forwards pickup and dropoff addresses to controller", async () => {
		const ctrl = makeController();
		const p2 = { street: "789 Pine St" };
		const d2 = { street: "321 Elm St" };
		await call(createDeliveryHandler, {
			body: {
				orderId: "order_1",
				pickupAddress: p2,
				dropoffAddress: d2,
				fee: 400,
			},
			controller: ctrl,
		});
		expect(ctrl.createDelivery).toHaveBeenCalledWith(
			expect.objectContaining({ pickupAddress: p2, dropoffAddress: d2 }),
		);
	});
});

// ── admin POST /doordash/zones ────────────────────────────────────────────────

describe("admin POST /doordash/zones", () => {
	it("creates a zone and returns it", async () => {
		const zone = makeZone({ name: "East Side" });
		const ctrl = makeController({
			createZone: vi.fn().mockResolvedValue(zone),
		});
		const result = (await call(createZoneHandler, {
			body: {
				name: "East Side",
				radius: 3,
				centerLat: 37.78,
				centerLng: -122.41,
				deliveryFee: 400,
				estimatedMinutes: 25,
			},
			controller: ctrl,
		})) as { zone: DeliveryZone };
		expect(result.zone.name).toBe("East Side");
		expect(ctrl.createZone).toHaveBeenCalledWith(
			expect.objectContaining({ name: "East Side" }),
		);
	});

	it("forwards all zone fields to controller", async () => {
		const ctrl = makeController();
		await call(createZoneHandler, {
			body: {
				name: "West Zone",
				radius: 10,
				centerLat: 37.75,
				centerLng: -122.45,
				deliveryFee: 600,
				estimatedMinutes: 45,
			},
			controller: ctrl,
		});
		expect(ctrl.createZone).toHaveBeenCalledWith(
			expect.objectContaining({
				radius: 10,
				deliveryFee: 600,
				estimatedMinutes: 45,
			}),
		);
	});
});

// ── admin DELETE /doordash/zones/:id ─────────────────────────────────────────

describe("admin DELETE /doordash/zones/:id", () => {
	it("returns deleted: false when zone not found", async () => {
		const result = (await call(deleteZoneHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes zone and returns deleted: true", async () => {
		const ctrl = makeController({
			deleteZone: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteZoneHandler, {
			params: { id: "zone_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.deleteZone).toHaveBeenCalledWith("zone_1");
	});
});

// ── admin GET /doordash/settings ──────────────────────────────────────────────

describe("admin GET /doordash/settings", () => {
	it("returns settings with status and configured fields", async () => {
		const result = (await call(settingsHandler)) as {
			status: string;
			configured: boolean;
		};
		expect(result).toHaveProperty("status");
		expect(result).toHaveProperty("configured");
	});

	it("returns not_configured when no credentials are set", async () => {
		const result = (await call(settingsHandler)) as {
			status: string;
			configured: boolean;
		};
		expect(result.configured).toBe(false);
		expect(result.status).toBe("not_configured");
	});
});

// ── admin GET /doordash/deliveries ────────────────────────────────────────────

describe("admin GET /doordash/deliveries", () => {
	it("returns empty list when no deliveries exist", async () => {
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

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listDeliveriesHandler, {
			query: { status: "delivered" },
			controller: ctrl,
		});
		expect(ctrl.listDeliveries).toHaveBeenCalledWith(
			expect.objectContaining({ status: "delivered" }),
		);
	});
});

// ── admin GET /doordash/zones ─────────────────────────────────────────────────

describe("admin GET /doordash/zones", () => {
	it("returns empty list when no zones exist", async () => {
		const result = (await call(listZonesHandler)) as {
			zones: DeliveryZone[];
			total: number;
		};
		expect(result.zones).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns zones from controller", async () => {
		const zones = [makeZone(), makeZone({ name: "North Zone" })];
		const ctrl = makeController({
			listZones: vi.fn().mockResolvedValue(zones),
		});
		const result = (await call(listZonesHandler, {
			controller: ctrl,
		})) as { zones: DeliveryZone[]; total: number };
		expect(result.zones).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

// ── admin PUT /doordash/deliveries/:id/status ─────────────────────────────────

describe("admin PUT /doordash/deliveries/:id/status", () => {
	it("returns 404 when delivery not found", async () => {
		const result = (await call(updateDeliveryStatusHandler, {
			params: { id: "missing" },
			body: { status: "delivered" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates delivery status and returns updated delivery", async () => {
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
		);
	});
});

// ── admin PUT /doordash/zones/:id ─────────────────────────────────────────────

describe("admin PUT /doordash/zones/:id", () => {
	it("returns 404 when zone not found", async () => {
		const result = (await call(updateZoneHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates zone and returns updated zone", async () => {
		const zone = makeZone({ id: "zone_1", name: "Updated Zone" });
		const ctrl = makeController({
			updateZone: vi.fn().mockResolvedValue(zone),
		});
		const result = (await call(updateZoneHandler, {
			params: { id: "zone_1" },
			body: { name: "Updated Zone" },
			controller: ctrl,
		})) as { zone: DeliveryZone };
		expect(result.zone.name).toBe("Updated Zone");
		expect(ctrl.updateZone).toHaveBeenCalledWith("zone_1", expect.anything());
	});
});
