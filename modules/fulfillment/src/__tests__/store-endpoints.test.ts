import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type {
	Fulfillment,
	FulfillmentItem,
	FulfillmentStatus,
} from "../service";
import { createTestFulfillmentController as createFulfillmentController } from "./test-controller";

/**
 * Store endpoint integration tests for the fulfillment module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-fulfillment: returns fulfillment by ID, 404 when missing
 * 2. list-by-order: returns fulfillments for an order, empty for unknown
 *
 * And the underlying controller logic used by endpoints:
 *
 * 3. createFulfillment: requires at least one item
 * 4. Status transitions: valid and invalid paths
 * 5. addTracking: success, rejection on delivered/cancelled
 * 6. autoShipOnTracking: auto-transitions to shipped
 * 7. cancelFulfillment: success, rejection on delivered, idempotent on cancelled
 */

// ── Helpers ───────────────────────────────────────────────────────────

type DataService = ReturnType<typeof createMockDataService>;
type Controller = ReturnType<typeof createFulfillmentController>;

const DEFAULT_ITEMS: FulfillmentItem[] = [{ lineItemId: "li_1", quantity: 2 }];

async function seedFulfillment(
	controller: Controller,
	overrides: {
		orderId?: string;
		items?: FulfillmentItem[];
		notes?: string;
		status?: FulfillmentStatus;
		carrier?: string;
		trackingNumber?: string;
	} = {},
): Promise<Fulfillment> {
	const fulfillment = await controller.createFulfillment({
		orderId: overrides.orderId ?? "order_1",
		items: overrides.items ?? DEFAULT_ITEMS,
		notes: overrides.notes,
	});

	// Transition through statuses if a non-default status is requested
	if (overrides.status && overrides.status !== "pending") {
		const path = statusPath(overrides.status);
		for (const step of path) {
			await controller.updateStatus(fulfillment.id, step);
		}
	}

	// Add tracking if requested
	if (overrides.carrier || overrides.trackingNumber) {
		await controller.addTracking(fulfillment.id, {
			carrier: overrides.carrier ?? "ups",
			trackingNumber: overrides.trackingNumber ?? "1Z999AA10123456784",
		});
	}

	const result = await controller.getFulfillment(fulfillment.id);
	return result as Fulfillment;
}

/** Returns the shortest transition path from "pending" to the target status. */
function statusPath(target: FulfillmentStatus): FulfillmentStatus[] {
	switch (target) {
		case "pending":
			return [];
		case "processing":
			return ["processing"];
		case "shipped":
			return ["shipped"];
		case "delivered":
			return ["shipped", "delivered"];
		case "cancelled":
			return ["cancelled"];
	}
}

// ── Simulate store endpoint logic ────────────────────────────────────

/**
 * Simulates GET /fulfillment/:id endpoint.
 * No auth required — returns fulfillment details or 404.
 */
async function simulateGetFulfillment(controller: Controller, id: string) {
	const fulfillment = await controller.getFulfillment(id);
	if (!fulfillment) {
		return { error: "Fulfillment not found", status: 404 };
	}
	return {
		fulfillment: {
			id: fulfillment.id,
			orderId: fulfillment.orderId,
			status: fulfillment.status,
			items: fulfillment.items,
			carrier: fulfillment.carrier,
			trackingNumber: fulfillment.trackingNumber,
			trackingUrl: fulfillment.trackingUrl,
			shippedAt: fulfillment.shippedAt,
			deliveredAt: fulfillment.deliveredAt,
			createdAt: fulfillment.createdAt,
		},
	};
}

/**
 * Simulates GET /fulfillment/order/:orderId endpoint.
 * No auth required — returns all fulfillments for an order.
 */
async function simulateListByOrder(controller: Controller, orderId: string) {
	const fulfillments = await controller.listByOrder(orderId);
	return {
		fulfillments: fulfillments.map((f) => ({
			id: f.id,
			orderId: f.orderId,
			status: f.status,
			items: f.items,
			carrier: f.carrier,
			trackingNumber: f.trackingNumber,
			trackingUrl: f.trackingUrl,
			shippedAt: f.shippedAt,
			deliveredAt: f.deliveredAt,
			createdAt: f.createdAt,
		})),
	};
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("store endpoint: get fulfillment", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createFulfillmentController(data);
	});

	it("returns fulfillment by ID", async () => {
		const fulfillment = await seedFulfillment(controller, {
			orderId: "order_abc",
			items: [{ lineItemId: "li_1", quantity: 3 }],
		});

		const result = await simulateGetFulfillment(controller, fulfillment.id);

		expect("fulfillment" in result).toBe(true);
		if (!("fulfillment" in result)) {
			throw new Error("expected 'fulfillment' in result");
		}
		expect(result.fulfillment.id).toBe(fulfillment.id);
		expect(result.fulfillment.orderId).toBe("order_abc");
		expect(result.fulfillment.status).toBe("pending");
		expect(result.fulfillment.items).toEqual([
			{ lineItemId: "li_1", quantity: 3 },
		]);
	});

	it("returns carrier and tracking when present", async () => {
		const fulfillment = await seedFulfillment(controller, {
			carrier: "fedex",
			trackingNumber: "TRACK123",
		});

		const result = await simulateGetFulfillment(controller, fulfillment.id);

		expect("fulfillment" in result).toBe(true);
		if (!("fulfillment" in result)) {
			throw new Error("expected 'fulfillment' in result");
		}
		expect(result.fulfillment.carrier).toBe("fedex");
		expect(result.fulfillment.trackingNumber).toBe("TRACK123");
	});

	it("returns shippedAt for shipped fulfillments", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "shipped",
		});

		const result = await simulateGetFulfillment(controller, fulfillment.id);

		expect("fulfillment" in result).toBe(true);
		if (!("fulfillment" in result)) {
			throw new Error("expected 'fulfillment' in result");
		}
		expect(result.fulfillment.status).toBe("shipped");
		expect(result.fulfillment.shippedAt).toBeDefined();
	});

	it("returns deliveredAt for delivered fulfillments", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "delivered",
		});

		const result = await simulateGetFulfillment(controller, fulfillment.id);

		expect("fulfillment" in result).toBe(true);
		if (!("fulfillment" in result)) {
			throw new Error("expected 'fulfillment' in result");
		}
		expect(result.fulfillment.status).toBe("delivered");
		expect(result.fulfillment.deliveredAt).toBeDefined();
	});

	it("returns 404 when fulfillment does not exist", async () => {
		const result = await simulateGetFulfillment(controller, "nonexistent_id");
		expect(result).toEqual({ error: "Fulfillment not found", status: 404 });
	});
});

describe("store endpoint: list by order", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createFulfillmentController(data);
	});

	it("returns all fulfillments for an order", async () => {
		await seedFulfillment(controller, { orderId: "order_1" });
		await seedFulfillment(controller, { orderId: "order_1" });
		await seedFulfillment(controller, { orderId: "order_other" });

		const result = await simulateListByOrder(controller, "order_1");

		expect(result.fulfillments).toHaveLength(2);
		for (const f of result.fulfillments) {
			expect(f.orderId).toBe("order_1");
		}
	});

	it("returns empty array for unknown order", async () => {
		await seedFulfillment(controller, { orderId: "order_1" });

		const result = await simulateListByOrder(controller, "order_unknown");

		expect(result.fulfillments).toHaveLength(0);
	});

	it("returns fulfillments with mixed statuses", async () => {
		await seedFulfillment(controller, {
			orderId: "order_1",
			status: "pending",
		});
		await seedFulfillment(controller, {
			orderId: "order_1",
			status: "shipped",
		});
		await seedFulfillment(controller, {
			orderId: "order_1",
			status: "delivered",
		});

		const result = await simulateListByOrder(controller, "order_1");

		expect(result.fulfillments).toHaveLength(3);
		const statuses = result.fulfillments.map((f) => f.status).sort();
		expect(statuses).toEqual(["delivered", "pending", "shipped"]);
	});

	it("includes tracking details in listed fulfillments", async () => {
		await seedFulfillment(controller, {
			orderId: "order_1",
			carrier: "usps",
			trackingNumber: "USPS123",
		});

		const result = await simulateListByOrder(controller, "order_1");

		expect(result.fulfillments).toHaveLength(1);
		expect(result.fulfillments[0].carrier).toBe("usps");
		expect(result.fulfillments[0].trackingNumber).toBe("USPS123");
	});

	it("does not include notes in response shape", async () => {
		await seedFulfillment(controller, {
			orderId: "order_1",
			notes: "Handle with care",
		});

		const result = await simulateListByOrder(controller, "order_1");

		expect(result.fulfillments).toHaveLength(1);
		// The endpoint maps to a specific shape that excludes notes
		const fulfillment = result.fulfillments[0] as Record<string, unknown>;
		expect(fulfillment.notes).toBeUndefined();
	});
});

describe("controller: createFulfillment", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createFulfillmentController(data);
	});

	it("creates a fulfillment with items", async () => {
		const fulfillment = await controller.createFulfillment({
			orderId: "order_1",
			items: [
				{ lineItemId: "li_1", quantity: 2 },
				{ lineItemId: "li_2", quantity: 1 },
			],
			notes: "Rush order",
		});

		expect(fulfillment.id).toBeDefined();
		expect(fulfillment.orderId).toBe("order_1");
		expect(fulfillment.status).toBe("pending");
		expect(fulfillment.items).toHaveLength(2);
		expect(fulfillment.items[0].lineItemId).toBe("li_1");
		expect(fulfillment.items[0].quantity).toBe(2);
		expect(fulfillment.items[1].lineItemId).toBe("li_2");
		expect(fulfillment.notes).toBe("Rush order");
		expect(fulfillment.createdAt).toBeInstanceOf(Date);
		expect(fulfillment.updatedAt).toBeInstanceOf(Date);
	});

	it("persists fulfillment so it can be retrieved", async () => {
		const created = await controller.createFulfillment({
			orderId: "order_1",
			items: [{ lineItemId: "li_1", quantity: 1 }],
		});

		const fetched = await controller.getFulfillment(created.id);
		expect(fetched).not.toBeNull();
		expect(fetched?.id).toBe(created.id);
		expect(fetched?.orderId).toBe("order_1");
	});

	it("throws when items array is empty", async () => {
		await expect(
			controller.createFulfillment({
				orderId: "order_1",
				items: [],
			}),
		).rejects.toThrow("Fulfillment must contain at least one Order line");
	});

	it("assigns unique IDs to each fulfillment", async () => {
		const first = await controller.createFulfillment({
			orderId: "order_1",
			items: [{ lineItemId: "li_1", quantity: 1 }],
		});
		const second = await controller.createFulfillment({
			orderId: "order_1",
			items: [{ lineItemId: "li_2", quantity: 1 }],
		});

		expect(first.id).not.toBe(second.id);
	});

	it("defaults to pending status", async () => {
		const fulfillment = await controller.createFulfillment({
			orderId: "order_1",
			items: [{ lineItemId: "li_1", quantity: 1 }],
		});

		expect(fulfillment.status).toBe("pending");
	});
});

describe("controller: status transitions", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createFulfillmentController(data);
	});

	// ── Valid transitions from pending ──────────────────────────────

	it("transitions pending → processing", async () => {
		const fulfillment = await seedFulfillment(controller);
		const updated = await controller.updateStatus(fulfillment.id, "processing");

		expect(updated?.status).toBe("processing");
	});

	it("transitions pending → shipped", async () => {
		const fulfillment = await seedFulfillment(controller);
		const updated = await controller.updateStatus(fulfillment.id, "shipped");

		expect(updated?.status).toBe("shipped");
		expect(updated?.shippedAt).toBeDefined();
	});

	it("transitions pending → cancelled", async () => {
		const fulfillment = await seedFulfillment(controller);
		const updated = await controller.updateStatus(fulfillment.id, "cancelled");

		expect(updated?.status).toBe("cancelled");
	});

	// ── Valid transitions from processing ───────────────────────────

	it("transitions processing → shipped", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "processing",
		});
		const updated = await controller.updateStatus(fulfillment.id, "shipped");

		expect(updated?.status).toBe("shipped");
		expect(updated?.shippedAt).toBeDefined();
	});

	it("transitions processing → cancelled", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "processing",
		});
		const updated = await controller.updateStatus(fulfillment.id, "cancelled");

		expect(updated?.status).toBe("cancelled");
	});

	// ── Valid transitions from shipped ──────────────────────────────

	it("transitions shipped → delivered", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "shipped",
		});
		const updated = await controller.updateStatus(fulfillment.id, "delivered");

		expect(updated?.status).toBe("delivered");
		expect(updated?.deliveredAt).toBeDefined();
	});

	it("transitions shipped → cancelled", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "shipped",
		});
		const updated = await controller.updateStatus(fulfillment.id, "cancelled");

		expect(updated?.status).toBe("cancelled");
	});

	// ── Invalid transitions ─────────────────────────────────────────

	it("rejects delivered → any transition", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "delivered",
		});

		for (const target of [
			"pending",
			"processing",
			"shipped",
			"cancelled",
		] as FulfillmentStatus[]) {
			await expect(
				controller.updateStatus(fulfillment.id, target),
			).rejects.toThrow(`Cannot transition from "delivered" to "${target}"`);
		}
	});

	it("rejects cancelled → any transition", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "cancelled",
		});

		for (const target of [
			"pending",
			"processing",
			"shipped",
			"delivered",
		] as FulfillmentStatus[]) {
			await expect(
				controller.updateStatus(fulfillment.id, target),
			).rejects.toThrow(`Cannot transition from "cancelled" to "${target}"`);
		}
	});

	it("rejects pending → delivered (must go through shipped)", async () => {
		const fulfillment = await seedFulfillment(controller);

		await expect(
			controller.updateStatus(fulfillment.id, "delivered"),
		).rejects.toThrow('Cannot transition from "pending" to "delivered"');
	});

	it("rejects processing → delivered (must go through shipped)", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "processing",
		});

		await expect(
			controller.updateStatus(fulfillment.id, "delivered"),
		).rejects.toThrow('Cannot transition from "processing" to "delivered"');
	});

	it("rejects processing → pending (no backward transitions)", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "processing",
		});

		await expect(
			controller.updateStatus(fulfillment.id, "pending"),
		).rejects.toThrow('Cannot transition from "processing" to "pending"');
	});

	it("rejects shipped → pending (no backward transitions)", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "shipped",
		});

		await expect(
			controller.updateStatus(fulfillment.id, "pending"),
		).rejects.toThrow('Cannot transition from "shipped" to "pending"');
	});

	it("rejects shipped → processing (no backward transitions)", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "shipped",
		});

		await expect(
			controller.updateStatus(fulfillment.id, "processing"),
		).rejects.toThrow('Cannot transition from "shipped" to "processing"');
	});

	it("returns null when updating status of nonexistent fulfillment", async () => {
		const result = await controller.updateStatus("nonexistent", "shipped");
		expect(result).toBeNull();
	});
});

describe("controller: addTracking", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createFulfillmentController(data);
	});

	it("adds tracking to a pending fulfillment", async () => {
		const fulfillment = await seedFulfillment(controller);

		const updated = await controller.addTracking(fulfillment.id, {
			carrier: "ups",
			trackingNumber: "1Z999AA10123456784",
			trackingUrl: "https://ups.com/track/1Z999AA10123456784",
		});

		expect(updated?.carrier).toBe("ups");
		expect(updated?.trackingNumber).toBe("1Z999AA10123456784");
		expect(updated?.trackingUrl).toBe(
			"https://ups.com/track/1Z999AA10123456784",
		);
	});

	it("adds tracking to a processing fulfillment", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "processing",
		});

		const updated = await controller.addTracking(fulfillment.id, {
			carrier: "fedex",
			trackingNumber: "FEDEX789",
		});

		expect(updated?.carrier).toBe("fedex");
		expect(updated?.trackingNumber).toBe("FEDEX789");
	});

	it("adds tracking to a shipped fulfillment", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "shipped",
		});

		const updated = await controller.addTracking(fulfillment.id, {
			carrier: "usps",
			trackingNumber: "USPS456",
		});

		expect(updated?.carrier).toBe("usps");
		expect(updated?.trackingNumber).toBe("USPS456");
		expect(updated?.status).toBe("shipped");
	});

	it("throws when adding tracking to a delivered fulfillment", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "delivered",
		});

		await expect(
			controller.addTracking(fulfillment.id, {
				carrier: "ups",
				trackingNumber: "1Z999",
			}),
		).rejects.toThrow("Cannot add tracking to a delivered fulfillment");
	});

	it("throws when adding tracking to a cancelled fulfillment", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "cancelled",
		});

		await expect(
			controller.addTracking(fulfillment.id, {
				carrier: "ups",
				trackingNumber: "1Z999",
			}),
		).rejects.toThrow("Cannot add tracking to a cancelled fulfillment");
	});

	it("returns null for nonexistent fulfillment", async () => {
		const result = await controller.addTracking("nonexistent", {
			carrier: "ups",
			trackingNumber: "1Z999",
		});

		expect(result).toBeNull();
	});

	it("overwrites previous tracking details", async () => {
		const fulfillment = await seedFulfillment(controller);

		await controller.addTracking(fulfillment.id, {
			carrier: "ups",
			trackingNumber: "OLD123",
		});

		const updated = await controller.addTracking(fulfillment.id, {
			carrier: "fedex",
			trackingNumber: "NEW456",
			trackingUrl: "https://fedex.com/track/NEW456",
		});

		expect(updated?.carrier).toBe("fedex");
		expect(updated?.trackingNumber).toBe("NEW456");
		expect(updated?.trackingUrl).toBe("https://fedex.com/track/NEW456");
	});
});

describe("controller: autoShipOnTracking", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("auto-transitions pending to shipped when tracking is added", async () => {
		const controller = createFulfillmentController(data, {
			options: { autoShipOnTracking: true },
		});
		const fulfillment = await controller.createFulfillment({
			orderId: "order_1",
			items: [{ lineItemId: "li_1", quantity: 1 }],
		});

		const updated = await controller.addTracking(fulfillment.id, {
			carrier: "ups",
			trackingNumber: "1Z999",
		});

		expect(updated?.status).toBe("shipped");
		expect(updated?.shippedAt).toBeDefined();
	});

	it("auto-transitions processing to shipped when tracking is added", async () => {
		const controller = createFulfillmentController(data, {
			options: { autoShipOnTracking: true },
		});
		const fulfillment = await controller.createFulfillment({
			orderId: "order_1",
			items: [{ lineItemId: "li_1", quantity: 1 }],
		});
		await controller.updateStatus(fulfillment.id, "processing");

		const updated = await controller.addTracking(fulfillment.id, {
			carrier: "fedex",
			trackingNumber: "FEDEX123",
		});

		expect(updated?.status).toBe("shipped");
		expect(updated?.shippedAt).toBeDefined();
	});

	it("does not auto-transition shipped fulfillment (already shipped)", async () => {
		const controller = createFulfillmentController(data, {
			options: { autoShipOnTracking: true },
		});
		const fulfillment = await controller.createFulfillment({
			orderId: "order_1",
			items: [{ lineItemId: "li_1", quantity: 1 }],
		});
		await controller.updateStatus(fulfillment.id, "shipped");

		const updated = await controller.addTracking(fulfillment.id, {
			carrier: "ups",
			trackingNumber: "1Z999",
		});

		// Status remains shipped, no double-transition
		expect(updated?.status).toBe("shipped");
	});

	it("does not auto-transition when autoShipOnTracking is false", async () => {
		const controller = createFulfillmentController(data, {
			options: { autoShipOnTracking: false },
		});
		const fulfillment = await controller.createFulfillment({
			orderId: "order_1",
			items: [{ lineItemId: "li_1", quantity: 1 }],
		});

		const updated = await controller.addTracking(fulfillment.id, {
			carrier: "ups",
			trackingNumber: "1Z999",
		});

		expect(updated?.status).toBe("pending");
		expect(updated?.shippedAt).toBeUndefined();
	});

	it("does not auto-transition when no options are provided", async () => {
		const controller = createFulfillmentController(data);
		const fulfillment = await controller.createFulfillment({
			orderId: "order_1",
			items: [{ lineItemId: "li_1", quantity: 1 }],
		});

		const updated = await controller.addTracking(fulfillment.id, {
			carrier: "ups",
			trackingNumber: "1Z999",
		});

		expect(updated?.status).toBe("pending");
	});
});

describe("controller: cancelFulfillment", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createFulfillmentController(data);
	});

	it("cancels a pending fulfillment", async () => {
		const fulfillment = await seedFulfillment(controller);

		const cancelled = await controller.cancelFulfillment(fulfillment.id);

		expect(cancelled?.status).toBe("cancelled");
	});

	it("cancels a processing fulfillment", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "processing",
		});

		const cancelled = await controller.cancelFulfillment(fulfillment.id);

		expect(cancelled?.status).toBe("cancelled");
	});

	it("cancels a shipped fulfillment", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "shipped",
		});

		const cancelled = await controller.cancelFulfillment(fulfillment.id);

		expect(cancelled?.status).toBe("cancelled");
	});

	it("throws when cancelling a delivered fulfillment", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "delivered",
		});

		await expect(controller.cancelFulfillment(fulfillment.id)).rejects.toThrow(
			"Cannot cancel a delivered fulfillment",
		);
	});

	it("returns existing fulfillment when already cancelled (idempotent)", async () => {
		const fulfillment = await seedFulfillment(controller, {
			status: "cancelled",
		});

		const result = await controller.cancelFulfillment(fulfillment.id);

		expect(result?.status).toBe("cancelled");
		expect(result?.id).toBe(fulfillment.id);
	});

	it("returns null for nonexistent fulfillment", async () => {
		const result = await controller.cancelFulfillment("nonexistent");

		expect(result).toBeNull();
	});

	it("persists the cancelled status", async () => {
		const fulfillment = await seedFulfillment(controller);

		await controller.cancelFulfillment(fulfillment.id);
		const fetched = await controller.getFulfillment(fulfillment.id);

		expect(fetched?.status).toBe("cancelled");
	});
});
