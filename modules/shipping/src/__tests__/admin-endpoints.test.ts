import { describe, expect, it, vi } from "vitest";
import { addRate } from "../admin/endpoints/add-rate";
import { createCarrier } from "../admin/endpoints/create-carrier";
import { createMethod } from "../admin/endpoints/create-method";
import { createShipment } from "../admin/endpoints/create-shipment";
import { createZone } from "../admin/endpoints/create-zone";
import { deleteCarrier } from "../admin/endpoints/delete-carrier";
import { deleteMethod } from "../admin/endpoints/delete-method";
import { deleteRate } from "../admin/endpoints/delete-rate";
import { deleteShipment } from "../admin/endpoints/delete-shipment";
import { deleteZone } from "../admin/endpoints/delete-zone";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { getShipment } from "../admin/endpoints/get-shipment";
import { listCarriers } from "../admin/endpoints/list-carriers";
import { listMethods } from "../admin/endpoints/list-methods";
import { listRates } from "../admin/endpoints/list-rates";
import { listShipments } from "../admin/endpoints/list-shipments";
import { listZones } from "../admin/endpoints/list-zones";
import { updateCarrier } from "../admin/endpoints/update-carrier";
import { updateMethod } from "../admin/endpoints/update-method";
import { updateRate } from "../admin/endpoints/update-rate";
import { updateShipment } from "../admin/endpoints/update-shipment";
import { updateShipmentStatus } from "../admin/endpoints/update-shipment-status";
import { updateZone } from "../admin/endpoints/update-zone";
import type {
	Shipment,
	ShippingCarrier,
	ShippingController,
	ShippingMethod,
	ShippingRate,
	ShippingZone,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeZone(overrides: Partial<ShippingZone> = {}): ShippingZone {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Domestic",
		countries: ["US"],
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeRate(overrides: Partial<ShippingRate> = {}): ShippingRate {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		zoneId: "zone_1",
		name: "Standard",
		price: 500,
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeMethod(overrides: Partial<ShippingMethod> = {}): ShippingMethod {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Ground",
		estimatedDaysMin: 3,
		estimatedDaysMax: 7,
		isActive: true,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCarrier(
	overrides: Partial<ShippingCarrier> = {},
): ShippingCarrier {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "FedEx",
		code: "fedex",
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		orderId: "order_1",
		status: "pending",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<ShippingController> = {},
): ShippingController {
	return {
		createZone: vi.fn().mockResolvedValue(makeZone()),
		getZone: vi.fn().mockResolvedValue(null),
		listZones: vi.fn().mockResolvedValue([]),
		updateZone: vi.fn().mockResolvedValue(null),
		deleteZone: vi.fn().mockResolvedValue(false),
		addRate: vi.fn().mockResolvedValue(makeRate()),
		getRate: vi.fn().mockResolvedValue(null),
		listRates: vi.fn().mockResolvedValue([]),
		updateRate: vi.fn().mockResolvedValue(null),
		deleteRate: vi.fn().mockResolvedValue(false),
		calculateRates: vi.fn().mockResolvedValue([]),
		createMethod: vi.fn().mockResolvedValue(makeMethod()),
		getMethod: vi.fn().mockResolvedValue(null),
		listMethods: vi.fn().mockResolvedValue([]),
		updateMethod: vi.fn().mockResolvedValue(null),
		deleteMethod: vi.fn().mockResolvedValue(false),
		createCarrier: vi.fn().mockResolvedValue(makeCarrier()),
		getCarrier: vi.fn().mockResolvedValue(null),
		listCarriers: vi.fn().mockResolvedValue([]),
		updateCarrier: vi.fn().mockResolvedValue(null),
		deleteCarrier: vi.fn().mockResolvedValue(false),
		createShipment: vi.fn().mockResolvedValue(makeShipment()),
		getShipment: vi.fn().mockResolvedValue(null),
		listShipments: vi.fn().mockResolvedValue([]),
		updateShipment: vi.fn().mockResolvedValue(null),
		updateShipmentStatus: vi.fn().mockResolvedValue(null),
		deleteShipment: vi.fn().mockResolvedValue(false),
		getTrackingUrl: vi.fn().mockResolvedValue(null),
		findShipmentByTrackingNumber: vi.fn().mockResolvedValue(null),
		getLiveRates: vi.fn().mockResolvedValue([]),
		purchaseLabel: vi.fn().mockResolvedValue(makeShipment()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: ShippingController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { shipping: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const createZoneHandler = extractHandler(createZone);
const listZonesHandler = extractHandler(listZones);
const updateZoneHandler = extractHandler(updateZone);
const deleteZoneHandler = extractHandler(deleteZone);
const addRateHandler = extractHandler(addRate);
const listRatesHandler = extractHandler(listRates);
const updateRateHandler = extractHandler(updateRate);
const deleteRateHandler = extractHandler(deleteRate);
const createMethodHandler = extractHandler(createMethod);
const listMethodsHandler = extractHandler(listMethods);
const updateMethodHandler = extractHandler(updateMethod);
const deleteMethodHandler = extractHandler(deleteMethod);
const createCarrierHandler = extractHandler(createCarrier);
const listCarriersHandler = extractHandler(listCarriers);
const updateCarrierHandler = extractHandler(updateCarrier);
const deleteCarrierHandler = extractHandler(deleteCarrier);
const createShipmentHandler = extractHandler(createShipment);
const getShipmentHandler = extractHandler(getShipment);
const listShipmentsHandler = extractHandler(listShipments);
const updateShipmentHandler = extractHandler(updateShipment);
const updateShipmentStatusHandler = extractHandler(updateShipmentStatus);
const deleteShipmentHandler = extractHandler(deleteShipment);

// ── Zones ─────────────────────────────────────────────────────────────────────

describe("admin POST /shipping/zones/create", () => {
	it("creates zone and returns it", async () => {
		const zone = makeZone({ name: "International", countries: ["GB", "DE"] });
		const ctrl = makeController({
			createZone: vi.fn().mockResolvedValue(zone),
		});
		const result = (await call(createZoneHandler, {
			body: { name: "International", countries: ["GB", "DE"] },
			controller: ctrl,
		})) as { zone: ShippingZone };
		expect(result.zone.name).toBe("International");
		expect(result.zone.countries).toContain("GB");
	});

	it("passes isActive to controller", async () => {
		const ctrl = makeController();
		await call(createZoneHandler, {
			body: { name: "West Coast", isActive: false },
			controller: ctrl,
		});
		expect(ctrl.createZone).toHaveBeenCalledWith(
			expect.objectContaining({ name: "West Coast", isActive: false }),
		);
	});
});

describe("admin GET /shipping/zones", () => {
	it("returns empty list when no zones", async () => {
		const result = (await call(listZonesHandler)) as {
			zones: ShippingZone[];
		};
		expect(result.zones).toHaveLength(0);
	});

	it("returns zones from controller", async () => {
		const zones = [makeZone(), makeZone()];
		const ctrl = makeController({
			listZones: vi.fn().mockResolvedValue(zones),
		});
		const result = (await call(listZonesHandler, { controller: ctrl })) as {
			zones: ShippingZone[];
		};
		expect(result.zones).toHaveLength(2);
	});
});

describe("admin PUT /shipping/zones/:id/update", () => {
	it("returns error when zone not found", async () => {
		const result = (await call(updateZoneHandler, {
			params: { id: "missing" },
			body: { name: "Updated" },
		})) as { error: string };
		expect(result.error).toMatch(/not found/i);
	});

	it("updates zone and returns it", async () => {
		const zone = makeZone({ name: "Updated Zone" });
		const ctrl = makeController({
			updateZone: vi.fn().mockResolvedValue(zone),
		});
		const result = (await call(updateZoneHandler, {
			params: { id: zone.id },
			body: { name: "Updated Zone" },
			controller: ctrl,
		})) as { zone: ShippingZone };
		expect(result.zone.name).toBe("Updated Zone");
	});
});

describe("admin DELETE /shipping/zones/:id/delete", () => {
	it("returns error when zone not found", async () => {
		const result = (await call(deleteZoneHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toMatch(/not found/i);
	});

	it("deletes zone and returns success", async () => {
		const ctrl = makeController({
			deleteZone: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteZoneHandler, {
			params: { id: "zone_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Rates ─────────────────────────────────────────────────────────────────────

describe("admin POST /shipping/zones/:id/rates/add", () => {
	it("adds rate and returns it", async () => {
		const rate = makeRate({ name: "Express", price: 1500 });
		const ctrl = makeController({ addRate: vi.fn().mockResolvedValue(rate) });
		const result = (await call(addRateHandler, {
			params: { id: "zone_1" },
			body: { name: "Express", price: 1500 },
			controller: ctrl,
		})) as { rate: ShippingRate };
		expect(result.rate.name).toBe("Express");
		expect(result.rate.price).toBe(1500);
	});

	it("passes zoneId from params to controller", async () => {
		const ctrl = makeController();
		await call(addRateHandler, {
			params: { id: "zone_99" },
			body: { name: "Flat", price: 0 },
			controller: ctrl,
		});
		expect(ctrl.addRate).toHaveBeenCalledWith(
			expect.objectContaining({ zoneId: "zone_99" }),
		);
	});
});

describe("admin GET /shipping/zones/:id/rates", () => {
	it("returns empty list when no rates", async () => {
		const result = (await call(listRatesHandler, {
			params: { id: "zone_1" },
		})) as { rates: ShippingRate[] };
		expect(result.rates).toHaveLength(0);
	});

	it("returns rates for zone from controller", async () => {
		const rates = [makeRate(), makeRate()];
		const ctrl = makeController({
			listRates: vi.fn().mockResolvedValue(rates),
		});
		const result = (await call(listRatesHandler, {
			params: { id: "zone_1" },
			controller: ctrl,
		})) as { rates: ShippingRate[] };
		expect(result.rates).toHaveLength(2);
	});
});

describe("admin PUT /shipping/rates/:id/update", () => {
	it("returns error when rate not found", async () => {
		const result = (await call(updateRateHandler, {
			params: { id: "missing" },
			body: { price: 999 },
		})) as { error: string };
		expect(result.error).toMatch(/not found/i);
	});

	it("updates rate and returns it", async () => {
		const rate = makeRate({ price: 999 });
		const ctrl = makeController({
			updateRate: vi.fn().mockResolvedValue(rate),
		});
		const result = (await call(updateRateHandler, {
			params: { id: rate.id },
			body: { price: 999 },
			controller: ctrl,
		})) as { rate: ShippingRate };
		expect(result.rate.price).toBe(999);
	});
});

describe("admin DELETE /shipping/rates/:id/delete", () => {
	it("returns error when rate not found", async () => {
		const result = (await call(deleteRateHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toMatch(/not found/i);
	});

	it("deletes rate and returns success", async () => {
		const ctrl = makeController({
			deleteRate: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteRateHandler, {
			params: { id: "rate_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Methods ───────────────────────────────────────────────────────────────────

describe("admin POST /shipping/methods/create", () => {
	it("creates method and returns it", async () => {
		const method = makeMethod({
			name: "Overnight",
			estimatedDaysMin: 1,
			estimatedDaysMax: 1,
		});
		const ctrl = makeController({
			createMethod: vi.fn().mockResolvedValue(method),
		});
		const result = (await call(createMethodHandler, {
			body: { name: "Overnight", estimatedDaysMin: 1, estimatedDaysMax: 1 },
			controller: ctrl,
		})) as { method: ShippingMethod };
		expect(result.method.name).toBe("Overnight");
		expect(result.method.estimatedDaysMin).toBe(1);
	});

	it("passes optional fields to controller", async () => {
		const ctrl = makeController();
		await call(createMethodHandler, {
			body: {
				name: "Ground",
				estimatedDaysMin: 3,
				estimatedDaysMax: 7,
				sortOrder: 2,
				isActive: false,
			},
			controller: ctrl,
		});
		expect(ctrl.createMethod).toHaveBeenCalledWith(
			expect.objectContaining({ sortOrder: 2, isActive: false }),
		);
	});
});

describe("admin GET /shipping/methods", () => {
	it("returns empty list when no methods", async () => {
		const result = (await call(listMethodsHandler)) as {
			methods: ShippingMethod[];
		};
		expect(result.methods).toHaveLength(0);
	});

	it("returns methods from controller", async () => {
		const methods = [makeMethod(), makeMethod()];
		const ctrl = makeController({
			listMethods: vi.fn().mockResolvedValue(methods),
		});
		const result = (await call(listMethodsHandler, { controller: ctrl })) as {
			methods: ShippingMethod[];
		};
		expect(result.methods).toHaveLength(2);
	});
});

describe("admin PUT /shipping/methods/:id/update", () => {
	it("returns error when method not found", async () => {
		const result = (await call(updateMethodHandler, {
			params: { id: "missing" },
			body: { name: "Updated" },
		})) as { error: string };
		expect(result.error).toMatch(/not found/i);
	});

	it("updates method and returns it", async () => {
		const method = makeMethod({ estimatedDaysMax: 5 });
		const ctrl = makeController({
			updateMethod: vi.fn().mockResolvedValue(method),
		});
		const result = (await call(updateMethodHandler, {
			params: { id: method.id },
			body: { estimatedDaysMax: 5 },
			controller: ctrl,
		})) as { method: ShippingMethod };
		expect(result.method.estimatedDaysMax).toBe(5);
	});
});

describe("admin DELETE /shipping/methods/:id/delete", () => {
	it("returns error when method not found", async () => {
		const result = (await call(deleteMethodHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toMatch(/not found/i);
	});

	it("deletes method and returns success", async () => {
		const ctrl = makeController({
			deleteMethod: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteMethodHandler, {
			params: { id: "method_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Carriers ──────────────────────────────────────────────────────────────────

describe("admin POST /shipping/carriers/create", () => {
	it("creates carrier and returns it", async () => {
		const carrier = makeCarrier({ name: "UPS", code: "ups" });
		const ctrl = makeController({
			createCarrier: vi.fn().mockResolvedValue(carrier),
		});
		const result = (await call(createCarrierHandler, {
			body: { name: "UPS", code: "ups" },
			controller: ctrl,
		})) as { carrier: ShippingCarrier };
		expect(result.carrier.name).toBe("UPS");
		expect(result.carrier.code).toBe("ups");
	});

	it("passes trackingUrlTemplate to controller", async () => {
		const ctrl = makeController();
		await call(createCarrierHandler, {
			body: {
				name: "USPS",
				code: "usps",
				trackingUrlTemplate:
					"https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}",
			},
			controller: ctrl,
		});
		expect(ctrl.createCarrier).toHaveBeenCalledWith(
			expect.objectContaining({ code: "usps" }),
		);
	});
});

describe("admin GET /shipping/carriers", () => {
	it("returns empty list when no carriers", async () => {
		const result = (await call(listCarriersHandler)) as {
			carriers: ShippingCarrier[];
		};
		expect(result.carriers).toHaveLength(0);
	});

	it("returns carriers from controller", async () => {
		const carriers = [makeCarrier(), makeCarrier()];
		const ctrl = makeController({
			listCarriers: vi.fn().mockResolvedValue(carriers),
		});
		const result = (await call(listCarriersHandler, { controller: ctrl })) as {
			carriers: ShippingCarrier[];
		};
		expect(result.carriers).toHaveLength(2);
	});
});

describe("admin PUT /shipping/carriers/:id/update", () => {
	it("returns error when carrier not found", async () => {
		const result = (await call(updateCarrierHandler, {
			params: { id: "missing" },
			body: { name: "Updated" },
		})) as { error: string };
		expect(result.error).toMatch(/not found/i);
	});

	it("updates carrier and returns it", async () => {
		const carrier = makeCarrier({ name: "DHL" });
		const ctrl = makeController({
			updateCarrier: vi.fn().mockResolvedValue(carrier),
		});
		const result = (await call(updateCarrierHandler, {
			params: { id: carrier.id },
			body: { name: "DHL" },
			controller: ctrl,
		})) as { carrier: ShippingCarrier };
		expect(result.carrier.name).toBe("DHL");
	});
});

describe("admin DELETE /shipping/carriers/:id/delete", () => {
	it("returns error when carrier not found", async () => {
		const result = (await call(deleteCarrierHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toMatch(/not found/i);
	});

	it("deletes carrier and returns success", async () => {
		const ctrl = makeController({
			deleteCarrier: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteCarrierHandler, {
			params: { id: "carrier_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Shipments ─────────────────────────────────────────────────────────────────

describe("admin POST /shipping/shipments/create", () => {
	it("creates shipment and returns it", async () => {
		const shipment = makeShipment({ orderId: "order_42" });
		const ctrl = makeController({
			createShipment: vi.fn().mockResolvedValue(shipment),
		});
		const result = (await call(createShipmentHandler, {
			body: { orderId: "order_42" },
			controller: ctrl,
		})) as { shipment: Shipment };
		expect(result.shipment.orderId).toBe("order_42");
		expect(result.shipment.status).toBe("pending");
	});

	it("passes optional tracking fields to controller", async () => {
		const ctrl = makeController();
		await call(createShipmentHandler, {
			body: {
				orderId: "order_1",
				trackingNumber: "TRACK123",
				carrierId: "carrier_1",
			},
			controller: ctrl,
		});
		expect(ctrl.createShipment).toHaveBeenCalledWith(
			expect.objectContaining({
				trackingNumber: "TRACK123",
				carrierId: "carrier_1",
			}),
		);
	});
});

describe("admin GET /shipping/shipments/:id", () => {
	it("returns error when shipment not found", async () => {
		const result = (await call(getShipmentHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toMatch(/not found/i);
	});

	it("returns shipment and trackingUrl when found", async () => {
		const shipment = makeShipment({ id: "ship_1" });
		const ctrl = makeController({
			getShipment: vi.fn().mockResolvedValue(shipment),
			getTrackingUrl: vi
				.fn()
				.mockResolvedValue("https://track.example.com/TRACK123"),
		});
		const result = (await call(getShipmentHandler, {
			params: { id: "ship_1" },
			controller: ctrl,
		})) as { shipment: Shipment; trackingUrl: string | null };
		expect(result.shipment.id).toBe("ship_1");
		expect(result.trackingUrl).toBe("https://track.example.com/TRACK123");
	});
});

describe("admin GET /shipping/shipments", () => {
	it("returns empty list when no shipments", async () => {
		const result = (await call(listShipmentsHandler)) as {
			shipments: Shipment[];
		};
		expect(result.shipments).toHaveLength(0);
	});

	it("returns shipments from controller", async () => {
		const shipments = [makeShipment(), makeShipment()];
		const ctrl = makeController({
			listShipments: vi.fn().mockResolvedValue(shipments),
		});
		const result = (await call(listShipmentsHandler, { controller: ctrl })) as {
			shipments: Shipment[];
		};
		expect(result.shipments).toHaveLength(2);
	});
});

describe("admin PUT /shipping/shipments/:id/update", () => {
	it("returns error when shipment not found", async () => {
		const result = (await call(updateShipmentHandler, {
			params: { id: "missing" },
			body: { notes: "test" },
		})) as { error: string };
		expect(result.error).toMatch(/not found/i);
	});

	it("updates shipment and returns it", async () => {
		const shipment = makeShipment({ trackingNumber: "NEWTRACK" });
		const ctrl = makeController({
			updateShipment: vi.fn().mockResolvedValue(shipment),
		});
		const result = (await call(updateShipmentHandler, {
			params: { id: shipment.id },
			body: { trackingNumber: "NEWTRACK" },
			controller: ctrl,
		})) as { shipment: Shipment };
		expect(result.shipment.trackingNumber).toBe("NEWTRACK");
	});
});

describe("admin PUT /shipping/shipments/:id/status", () => {
	it("returns error when shipment not found or invalid transition", async () => {
		const result = (await call(updateShipmentStatusHandler, {
			params: { id: "missing" },
			body: { status: "shipped" },
		})) as { error: string };
		expect(result.error).toBeTruthy();
	});

	it("updates shipment status and returns updated shipment", async () => {
		const shipment = makeShipment({ status: "shipped" });
		const ctrl = makeController({
			updateShipmentStatus: vi.fn().mockResolvedValue(shipment),
		});
		const result = (await call(updateShipmentStatusHandler, {
			params: { id: shipment.id },
			body: { status: "shipped" },
			controller: ctrl,
		})) as { shipment: Shipment };
		expect(result.shipment.status).toBe("shipped");
	});
});

describe("admin DELETE /shipping/shipments/:id/delete", () => {
	it("returns error when shipment not found", async () => {
		const result = (await call(deleteShipmentHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toMatch(/not found/i);
	});

	it("deletes shipment and returns success", async () => {
		const ctrl = makeController({
			deleteShipment: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteShipmentHandler, {
			params: { id: "ship_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Settings ──────────────────────────────────────────────────────────────────

describe("admin GET /shipping/settings", () => {
	const settingsContext = {
		context: {
			controllers: {
				shippingV2: {
					getConnection: vi.fn().mockResolvedValue(null),
				},
			},
		},
	};

	it("returns not_configured and configured=false when no API key", async () => {
		const endpoint = createGetSettingsEndpoint({});
		const handler = extractHandler(endpoint);
		const result = (await handler({
			query: {},
			params: {},
			body: {},
			...settingsContext,
		})) as { status: string; configured: boolean; originConfigured: boolean };
		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.originConfigured).toBe(false);
	});

	it("returns unavailable when only the API key is present", async () => {
		const endpoint = createGetSettingsEndpoint({
			easypostApiKey: "EZTKtest_key_abc123",
		});
		const handler = extractHandler(endpoint);
		const result = (await handler({
			query: {},
			params: {},
			body: {},
			...settingsContext,
		})) as { status: string; configured: boolean; apiKeyMasked: string | null };
		expect(result.configured).toBe(false);
		expect(result.apiKeyMasked).not.toBeNull();
		expect(result.status).toBe("not_configured");
	});
});
