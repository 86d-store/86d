import { describe, expect, it, vi } from "vitest";
import { addTracking } from "../admin/endpoints/add-tracking";
import { cancelFulfillment } from "../admin/endpoints/cancel-fulfillment";
import { createFulfillment } from "../admin/endpoints/create-fulfillment";
import { getFulfillment } from "../admin/endpoints/get-fulfillment";
import { listByOrder } from "../admin/endpoints/list-by-order";
import { listFulfillments } from "../admin/endpoints/list-fulfillments";
import { updateStatus } from "../admin/endpoints/update-status";
import type { Fulfillment, FulfillmentController } from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeFulfillment(overrides: Partial<Fulfillment> = {}): Fulfillment {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		orderId: "order-1",
		status: "pending",
		items: [{ lineItemId: "li-1", quantity: 1 }],
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<FulfillmentController> = {},
): FulfillmentController {
	return {
		createFulfillment: vi.fn().mockResolvedValue(makeFulfillment()),
		getFulfillment: vi.fn().mockResolvedValue(null),
		listByOrder: vi.fn().mockResolvedValue([]),
		listFulfillments: vi.fn().mockResolvedValue([]),
		updateStatus: vi.fn().mockResolvedValue(null),
		addTracking: vi.fn().mockResolvedValue(null),
		cancelFulfillment: vi.fn().mockResolvedValue(null),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: FulfillmentController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { fulfillment: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listHandler = extractHandler(listFulfillments);
const createHandler = extractHandler(createFulfillment);
const getHandler = extractHandler(getFulfillment);
const updateStatusHandler = extractHandler(updateStatus);
const addTrackingHandler = extractHandler(addTracking);
const cancelHandler = extractHandler(cancelFulfillment);
const listByOrderHandler = extractHandler(listByOrder);

// ── admin GET /fulfillment ────────────────────────────────────────────────────

describe("admin GET /fulfillment", () => {
	it("returns empty list when no fulfillments exist", async () => {
		const result = (await call(listHandler)) as {
			fulfillments: Fulfillment[];
		};
		expect(result.fulfillments).toHaveLength(0);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { status: "shipped" }, controller: ctrl });
		expect(ctrl.listFulfillments).toHaveBeenCalledWith(
			expect.objectContaining({ status: "shipped" }),
		);
	});
});

// ── admin POST /fulfillment/create ────────────────────────────────────────────

describe("admin POST /fulfillment/create", () => {
	it("creates a fulfillment and returns it", async () => {
		const fulfillment = makeFulfillment({ orderId: "order-99" });
		const ctrl = makeController({
			createFulfillment: vi.fn().mockResolvedValue(fulfillment),
		});
		const result = (await call(createHandler, {
			body: {
				orderId: "order-99",
				items: [{ lineItemId: "li-1", quantity: 2 }],
			},
			controller: ctrl,
		})) as { fulfillment: Fulfillment };
		expect(result.fulfillment.orderId).toBe("order-99");
	});

	it("calls controller with orderId and items", async () => {
		const ctrl = makeController();
		const items = [{ lineItemId: "li-5", quantity: 3 }];
		await call(createHandler, {
			body: { orderId: "order-42", items },
			controller: ctrl,
		});
		expect(ctrl.createFulfillment).toHaveBeenCalledWith(
			expect.objectContaining({ orderId: "order-42", items }),
		);
	});
});

// ── admin GET /fulfillment/:id ────────────────────────────────────────────────

describe("admin GET /fulfillment/:id", () => {
	it("returns 404 when fulfillment not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Fulfillment not found");
	});

	it("returns fulfillment when found", async () => {
		const fulfillment = makeFulfillment({ id: "f1" });
		const ctrl = makeController({
			getFulfillment: vi.fn().mockResolvedValue(fulfillment),
		});
		const result = (await call(getHandler, {
			params: { id: "f1" },
			controller: ctrl,
		})) as { fulfillment: Fulfillment };
		expect(result.fulfillment.id).toBe("f1");
	});
});

// ── admin POST /fulfillment/:id/status ────────────────────────────────────────

describe("admin POST /fulfillment/:id/status", () => {
	it("returns 404 when fulfillment not found", async () => {
		const result = (await call(updateStatusHandler, {
			params: { id: "missing" },
			body: { status: "shipped" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated fulfillment on success", async () => {
		const fulfillment = makeFulfillment({ id: "f2", status: "shipped" });
		const ctrl = makeController({
			updateStatus: vi.fn().mockResolvedValue(fulfillment),
		});
		const result = (await call(updateStatusHandler, {
			params: { id: "f2" },
			body: { status: "shipped" },
			controller: ctrl,
		})) as { fulfillment: Fulfillment };
		expect(result.fulfillment.status).toBe("shipped");
	});
});

// ── admin POST /fulfillment/:id/tracking ──────────────────────────────────────

describe("admin POST /fulfillment/:id/tracking", () => {
	it("returns 404 when fulfillment not found", async () => {
		const result = (await call(addTrackingHandler, {
			params: { id: "missing" },
			body: { carrier: "UPS", trackingNumber: "1Z999AA10123456784" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns fulfillment with tracking info on success", async () => {
		const fulfillment = makeFulfillment({
			id: "f3",
			carrier: "UPS",
			trackingNumber: "1Z999AA10123456784",
		});
		const ctrl = makeController({
			addTracking: vi.fn().mockResolvedValue(fulfillment),
		});
		const result = (await call(addTrackingHandler, {
			params: { id: "f3" },
			body: { carrier: "UPS", trackingNumber: "1Z999AA10123456784" },
			controller: ctrl,
		})) as { fulfillment: Fulfillment };
		expect(result.fulfillment.carrier).toBe("UPS");
		expect(result.fulfillment.trackingNumber).toBe("1Z999AA10123456784");
	});
});

// ── admin POST /fulfillment/:id/cancel ────────────────────────────────────────

describe("admin POST /fulfillment/:id/cancel", () => {
	it("returns 404 when fulfillment not found", async () => {
		const result = (await call(cancelHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns cancelled fulfillment on success", async () => {
		const fulfillment = makeFulfillment({ id: "f4", status: "cancelled" });
		const ctrl = makeController({
			cancelFulfillment: vi.fn().mockResolvedValue(fulfillment),
		});
		const result = (await call(cancelHandler, {
			params: { id: "f4" },
			controller: ctrl,
		})) as { fulfillment: Fulfillment };
		expect(result.fulfillment.status).toBe("cancelled");
	});
});

// ── admin GET /fulfillment/order/:orderId ─────────────────────────────────────

describe("admin GET /fulfillment/order/:orderId", () => {
	it("returns empty list when no fulfillments for order", async () => {
		const result = (await call(listByOrderHandler, {
			params: { orderId: "order-empty" },
		})) as { fulfillments: Fulfillment[] };
		expect(result.fulfillments).toHaveLength(0);
	});

	it("returns fulfillments for the given orderId", async () => {
		const fulfillments = [
			makeFulfillment({ orderId: "order-5" }),
			makeFulfillment({ orderId: "order-5" }),
		];
		const ctrl = makeController({
			listByOrder: vi.fn().mockResolvedValue(fulfillments),
		});
		const result = (await call(listByOrderHandler, {
			params: { orderId: "order-5" },
			controller: ctrl,
		})) as { fulfillments: Fulfillment[] };
		expect(result.fulfillments).toHaveLength(2);
		expect(ctrl.listByOrder).toHaveBeenCalledWith("order-5");
	});
});
