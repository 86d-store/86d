import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createInventoryController } from "../service-impl";

/**
 * Store endpoint integration tests for the inventory module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. check-stock: combines isInStock + getStock into a single response
 * 2. back-in-stock-subscribe: guest vs authenticated subscription creation
 * 3. back-in-stock-unsubscribe: subscription removal
 * 4. back-in-stock-check: subscription status checking
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate store endpoint logic ─────────────────────────────────────

/**
 * Simulates the check-stock endpoint: calls isInStock and getStock,
 * then combines results into the response shape.
 */
async function simulateCheckStock(
	data: DataService,
	query: {
		productId: string;
		variantId?: string;
		locationId?: string;
		quantity?: number;
	},
) {
	const controller = createInventoryController(data);
	const inStock = await controller.isInStock({
		productId: query.productId,
		variantId: query.variantId,
		locationId: query.locationId,
		quantity: query.quantity,
	});
	const item = await controller.getStock({
		productId: query.productId,
		variantId: query.variantId,
		locationId: query.locationId,
	});
	return {
		inStock,
		available: item?.available ?? null,
		allowBackorder: item?.allowBackorder ?? false,
	};
}

/**
 * Simulates the back-in-stock subscribe endpoint: passes session customerId
 * alongside the request body to the controller.
 */
async function simulateSubscribe(
	data: DataService,
	body: {
		productId: string;
		variantId?: string;
		email: string;
		productName?: string;
	},
	session?: { user: { id: string } },
) {
	const controller = createInventoryController(data);
	const customerId = session?.user.id;
	const subscription = await controller.subscribeBackInStock({
		productId: body.productId,
		variantId: body.variantId,
		email: body.email,
		customerId,
		productName: body.productName,
	});
	return { subscription };
}

/**
 * Simulates the back-in-stock unsubscribe endpoint.
 */
async function simulateUnsubscribe(
	data: DataService,
	body: {
		productId: string;
		variantId?: string;
		email: string;
	},
) {
	const controller = createInventoryController(data);
	const removed = await controller.unsubscribeBackInStock({
		productId: body.productId,
		variantId: body.variantId,
		email: body.email,
	});
	return { removed };
}

/**
 * Simulates the back-in-stock check endpoint.
 */
async function simulateCheckSubscription(
	data: DataService,
	query: {
		productId: string;
		variantId?: string;
		email: string;
	},
) {
	const controller = createInventoryController(data);
	const subscribed = await controller.checkBackInStockSubscription({
		productId: query.productId,
		variantId: query.variantId,
		email: query.email,
	});
	return { subscribed };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("inventory store endpoints", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	// ── check-stock ──────────────────────────────────────────────────

	describe("check-stock", () => {
		it("returns in-stock for untracked products (no inventory record)", async () => {
			const result = await simulateCheckStock(data, {
				productId: "unknown-product",
			});
			expect(result).toEqual({
				inStock: true,
				available: null,
				allowBackorder: false,
			});
		});

		it("returns in-stock with available count when stock exists", async () => {
			const controller = createInventoryController(data);
			await controller.setStock({
				productId: "prod-1",
				quantity: 50,
			});

			const result = await simulateCheckStock(data, {
				productId: "prod-1",
			});
			expect(result).toEqual({
				inStock: true,
				available: 50,
				allowBackorder: false,
			});
		});

		it("returns out-of-stock when available is zero", async () => {
			const controller = createInventoryController(data);
			await controller.setStock({
				productId: "prod-1",
				quantity: 5,
			});
			// Reserve all stock
			await controller.reserve({
				productId: "prod-1",
				quantity: 5,
			});

			const result = await simulateCheckStock(data, {
				productId: "prod-1",
			});
			expect(result).toEqual({
				inStock: false,
				available: 0,
				allowBackorder: false,
			});
		});

		it("returns in-stock for zero-available when backorder is allowed", async () => {
			const controller = createInventoryController(data);
			await controller.setStock({
				productId: "prod-1",
				quantity: 0,
				allowBackorder: true,
			});

			const result = await simulateCheckStock(data, {
				productId: "prod-1",
			});
			expect(result).toEqual({
				inStock: true,
				available: 0,
				allowBackorder: true,
			});
		});

		it("respects requested quantity for stock check", async () => {
			const controller = createInventoryController(data);
			await controller.setStock({
				productId: "prod-1",
				quantity: 3,
			});

			// Requesting 2 — should be in stock
			const twoResult = await simulateCheckStock(data, {
				productId: "prod-1",
				quantity: 2,
			});
			expect(twoResult.inStock).toBe(true);

			// Requesting 5 — insufficient stock
			const fiveResult = await simulateCheckStock(data, {
				productId: "prod-1",
				quantity: 5,
			});
			expect(fiveResult.inStock).toBe(false);
		});

		it("checks stock for specific variant", async () => {
			const controller = createInventoryController(data);
			await controller.setStock({
				productId: "prod-1",
				variantId: "size-large",
				quantity: 10,
			});
			await controller.setStock({
				productId: "prod-1",
				variantId: "size-small",
				quantity: 0,
			});

			const large = await simulateCheckStock(data, {
				productId: "prod-1",
				variantId: "size-large",
			});
			expect(large.inStock).toBe(true);
			expect(large.available).toBe(10);

			const small = await simulateCheckStock(data, {
				productId: "prod-1",
				variantId: "size-small",
			});
			expect(small.inStock).toBe(false);
			expect(small.available).toBe(0);
		});

		it("checks stock for specific location", async () => {
			const controller = createInventoryController(data);
			await controller.setStock({
				productId: "prod-1",
				locationId: "warehouse-a",
				quantity: 20,
			});

			const result = await simulateCheckStock(data, {
				productId: "prod-1",
				locationId: "warehouse-a",
			});
			expect(result.available).toBe(20);

			// Different location has no record
			const other = await simulateCheckStock(data, {
				productId: "prod-1",
				locationId: "warehouse-b",
			});
			expect(other.available).toBeNull();
		});

		it("reflects reserved stock in available count", async () => {
			const controller = createInventoryController(data);
			await controller.setStock({
				productId: "prod-1",
				quantity: 10,
			});
			await controller.reserve({
				productId: "prod-1",
				quantity: 3,
			});

			const result = await simulateCheckStock(data, {
				productId: "prod-1",
			});
			expect(result.available).toBe(7);
			expect(result.inStock).toBe(true);
		});
	});

	// ── back-in-stock subscribe ──────────────────────────────────────

	describe("back-in-stock subscribe", () => {
		it("creates subscription for guest user (no session)", async () => {
			const result = await simulateSubscribe(data, {
				productId: "prod-1",
				email: "guest@example.com",
				productName: "Cool Widget",
			});

			expect(result.subscription).toMatchObject({
				productId: "prod-1",
				email: "guest@example.com",
				productName: "Cool Widget",
				status: "active",
			});
			expect(result.subscription.customerId).toBeUndefined();
		});

		it("creates subscription with customerId for authenticated user", async () => {
			const result = await simulateSubscribe(
				data,
				{
					productId: "prod-1",
					email: "user@example.com",
					productName: "Widget",
				},
				{ user: { id: "cust-42" } },
			);

			expect(result.subscription.customerId).toBe("cust-42");
			expect(result.subscription.email).toBe("user@example.com");
		});

		it("lowercases email in subscription", async () => {
			const result = await simulateSubscribe(data, {
				productId: "prod-1",
				email: "USER@EXAMPLE.COM",
			});

			expect(result.subscription.email).toBe("user@example.com");
		});

		it("returns existing active subscription on duplicate subscribe", async () => {
			const first = await simulateSubscribe(data, {
				productId: "prod-1",
				email: "user@example.com",
			});
			const second = await simulateSubscribe(data, {
				productId: "prod-1",
				email: "user@example.com",
			});

			expect(second.subscription.id).toBe(first.subscription.id);
			expect(second.subscription.subscribedAt).toEqual(
				first.subscription.subscribedAt,
			);
		});

		it("creates separate subscriptions for different variants", async () => {
			const sub1 = await simulateSubscribe(data, {
				productId: "prod-1",
				variantId: "red",
				email: "user@example.com",
			});
			const sub2 = await simulateSubscribe(data, {
				productId: "prod-1",
				variantId: "blue",
				email: "user@example.com",
			});

			expect(sub1.subscription.id).not.toBe(sub2.subscription.id);
		});

		it("re-subscribes after a previous notification", async () => {
			const controller = createInventoryController(data);

			// Subscribe, then simulate notification (mark as notified)
			await controller.subscribeBackInStock({
				productId: "prod-1",
				email: "user@example.com",
			});
			await controller.markSubscribersNotified({ productId: "prod-1" });

			// Re-subscribe should create a fresh active subscription
			const result = await simulateSubscribe(data, {
				productId: "prod-1",
				email: "user@example.com",
			});
			expect(result.subscription.status).toBe("active");
		});
	});

	// ── back-in-stock unsubscribe ────────────────────────────────────

	describe("back-in-stock unsubscribe", () => {
		it("removes an existing subscription", async () => {
			await simulateSubscribe(data, {
				productId: "prod-1",
				email: "user@example.com",
			});

			const result = await simulateUnsubscribe(data, {
				productId: "prod-1",
				email: "user@example.com",
			});
			expect(result.removed).toBe(true);

			// Verify it's actually gone
			const check = await simulateCheckSubscription(data, {
				productId: "prod-1",
				email: "user@example.com",
			});
			expect(check.subscribed).toBe(false);
		});

		it("returns false when no subscription exists", async () => {
			const result = await simulateUnsubscribe(data, {
				productId: "nonexistent",
				email: "nobody@example.com",
			});
			expect(result.removed).toBe(false);
		});

		it("only removes the targeted variant subscription", async () => {
			await simulateSubscribe(data, {
				productId: "prod-1",
				variantId: "red",
				email: "user@example.com",
			});
			await simulateSubscribe(data, {
				productId: "prod-1",
				variantId: "blue",
				email: "user@example.com",
			});

			await simulateUnsubscribe(data, {
				productId: "prod-1",
				variantId: "red",
				email: "user@example.com",
			});

			// Red should be gone, blue should remain
			const red = await simulateCheckSubscription(data, {
				productId: "prod-1",
				variantId: "red",
				email: "user@example.com",
			});
			const blue = await simulateCheckSubscription(data, {
				productId: "prod-1",
				variantId: "blue",
				email: "user@example.com",
			});
			expect(red.subscribed).toBe(false);
			expect(blue.subscribed).toBe(true);
		});
	});

	// ── back-in-stock check ──────────────────────────────────────────

	describe("back-in-stock check", () => {
		it("returns false when not subscribed", async () => {
			const result = await simulateCheckSubscription(data, {
				productId: "prod-1",
				email: "user@example.com",
			});
			expect(result.subscribed).toBe(false);
		});

		it("returns true for active subscription", async () => {
			await simulateSubscribe(data, {
				productId: "prod-1",
				email: "user@example.com",
			});

			const result = await simulateCheckSubscription(data, {
				productId: "prod-1",
				email: "user@example.com",
			});
			expect(result.subscribed).toBe(true);
		});

		it("returns false after subscription was notified", async () => {
			const controller = createInventoryController(data);
			await controller.subscribeBackInStock({
				productId: "prod-1",
				email: "user@example.com",
			});
			await controller.markSubscribersNotified({ productId: "prod-1" });

			const result = await simulateCheckSubscription(data, {
				productId: "prod-1",
				email: "user@example.com",
			});
			expect(result.subscribed).toBe(false);
		});

		it("returns false after unsubscribe", async () => {
			await simulateSubscribe(data, {
				productId: "prod-1",
				email: "user@example.com",
			});
			await simulateUnsubscribe(data, {
				productId: "prod-1",
				email: "user@example.com",
			});

			const result = await simulateCheckSubscription(data, {
				productId: "prod-1",
				email: "user@example.com",
			});
			expect(result.subscribed).toBe(false);
		});

		it("checks correct variant subscription", async () => {
			await simulateSubscribe(data, {
				productId: "prod-1",
				variantId: "red",
				email: "user@example.com",
			});

			const red = await simulateCheckSubscription(data, {
				productId: "prod-1",
				variantId: "red",
				email: "user@example.com",
			});
			const blue = await simulateCheckSubscription(data, {
				productId: "prod-1",
				variantId: "blue",
				email: "user@example.com",
			});
			expect(red.subscribed).toBe(true);
			expect(blue.subscribed).toBe(false);
		});
	});
});
