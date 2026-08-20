import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type {
	AbandonedCartController,
	CartItemSnapshot,
	CreateAbandonedCartParams,
} from "../service";
import { createAbandonedCartController } from "../service-impl";

/**
 * Tests for store-facing endpoints:
 * - POST /abandoned-carts/track  (trackAbandoned)
 * - GET  /abandoned-carts/recover/:token  (recoverCart)
 *
 * These test the controller logic that endpoints invoke,
 * including deduplication, token-based recovery, and status checks.
 */

const sampleItems: CartItemSnapshot[] = [
	{ productId: "prod_1", name: "T-Shirt", price: 25, quantity: 1 },
	{ productId: "prod_2", name: "Hoodie", price: 60, quantity: 2 },
];

function makeParams(
	overrides: Partial<CreateAbandonedCartParams> = {},
): CreateAbandonedCartParams {
	return {
		cartId: `cart_${crypto.randomUUID().slice(0, 8)}`,
		items: sampleItems,
		cartTotal: 145,
		...overrides,
	};
}

describe("store endpoints — track abandoned", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: AbandonedCartController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAbandonedCartController(mockData);
	});

	// ── Track: Basic Creation ─────────────────────────────────────────

	it("creates a new abandoned cart with required fields", async () => {
		const cart = await controller.create(makeParams({ cartId: "cart_abc" }));

		expect(cart.id).toBeDefined();
		expect(cart.cartId).toBe("cart_abc");
		expect(cart.status).toBe("active");
		expect(cart.items).toHaveLength(2);
		expect(cart.cartTotal).toBe(145);
		expect(cart.currency).toBe("USD");
		expect(cart.recoveryToken).toBeDefined();
		expect(cart.attemptCount).toBe(0);
	});

	it("creates with custom currency", async () => {
		const cart = await controller.create(makeParams({ currency: "EUR" }));
		expect(cart.currency).toBe("EUR");
	});

	it("creates with email and customerId", async () => {
		const cart = await controller.create(
			makeParams({
				email: "user@example.com",
				customerId: "cust_123",
			}),
		);
		expect(cart.email).toBe("user@example.com");
		expect(cart.customerId).toBe("cust_123");
	});

	// ── Track: Deduplication ──────────────────────────────────────────

	it("deduplicates by cartId — same active cart returns existing", async () => {
		const cart1 = await controller.create(makeParams({ cartId: "dup_cart" }));

		// Simulate endpoint dedup logic: check getByCartId first
		const existing = await controller.getByCartId("dup_cart");
		expect(existing).not.toBeNull();
		expect(existing?.id).toBe(cart1.id);
		expect(existing?.status).toBe("active");
	});

	it("allows re-tracking after cart is recovered", async () => {
		const cart1 = await controller.create(makeParams({ cartId: "retrack" }));
		await controller.markRecovered(cart1.id, "order_1");

		// After recovery, getByCartId still returns the recovered one
		const existing = await controller.getByCartId("retrack");
		expect(existing?.status).toBe("recovered");

		// Endpoint logic: status !== "active" → create new
		const cart2 = await controller.create(makeParams({ cartId: "retrack" }));
		expect(cart2.id).not.toBe(cart1.id);
		expect(cart2.status).toBe("active");
	});

	it("allows re-tracking after cart is expired", async () => {
		const cart1 = await controller.create(
			makeParams({ cartId: "expired_retrack" }),
		);
		await controller.markExpired(cart1.id);

		const cart2 = await controller.create(
			makeParams({ cartId: "expired_retrack" }),
		);
		expect(cart2.id).not.toBe(cart1.id);
		expect(cart2.status).toBe("active");
	});

	it("allows re-tracking after cart is dismissed", async () => {
		const cart1 = await controller.create(
			makeParams({ cartId: "dismissed_retrack" }),
		);
		await controller.dismiss(cart1.id);

		const cart2 = await controller.create(
			makeParams({ cartId: "dismissed_retrack" }),
		);
		expect(cart2.id).not.toBe(cart1.id);
	});

	// ── Track: Items Snapshot ─────────────────────────────────────────

	it("stores items snapshot with all fields", async () => {
		const items: CartItemSnapshot[] = [
			{
				productId: "p1",
				variantId: "v1",
				name: "Widget",
				sku: "WDG-001",
				price: 49.99,
				quantity: 3,
				imageUrl: "https://example.com/widget.jpg",
			},
		];
		const cart = await controller.create(
			makeParams({ items, cartTotal: 149.97 }),
		);
		expect(cart.items).toHaveLength(1);
		expect(cart.items[0].productId).toBe("p1");
		expect(cart.items[0].variantId).toBe("v1");
		expect(cart.items[0].sku).toBe("WDG-001");
		expect(cart.items[0].imageUrl).toBe("https://example.com/widget.jpg");
	});

	it("stores items with minimal fields", async () => {
		const items: CartItemSnapshot[] = [
			{ productId: "p1", name: "A", price: 10, quantity: 1 },
		];
		const cart = await controller.create(makeParams({ items, cartTotal: 10 }));
		expect(cart.items[0].variantId).toBeUndefined();
		expect(cart.items[0].sku).toBeUndefined();
		expect(cart.items[0].imageUrl).toBeUndefined();
	});

	it("stores multiple items correctly", async () => {
		const items: CartItemSnapshot[] = Array.from({ length: 10 }, (_, i) => ({
			productId: `prod_${i}`,
			name: `Product ${i}`,
			price: 10 + i,
			quantity: i + 1,
		}));
		const cart = await controller.create(makeParams({ items, cartTotal: 550 }));
		expect(cart.items).toHaveLength(10);
	});

	// ── Track: Timestamps ─────────────────────────────────────────────

	it("sets abandonedAt and createdAt to current time", async () => {
		const before = new Date();
		const cart = await controller.create(makeParams());
		const after = new Date();

		expect(new Date(cart.abandonedAt).getTime()).toBeGreaterThanOrEqual(
			before.getTime(),
		);
		expect(new Date(cart.abandonedAt).getTime()).toBeLessThanOrEqual(
			after.getTime(),
		);
		expect(new Date(cart.createdAt).getTime()).toBeGreaterThanOrEqual(
			before.getTime(),
		);
	});

	// ── Track: Recovery Token ─────────────────────────────────────────

	it("generates unique recovery tokens for each cart", async () => {
		const tokens = new Set<string>();
		for (let i = 0; i < 20; i++) {
			const cart = await controller.create(makeParams());
			tokens.add(cart.recoveryToken);
		}
		expect(tokens.size).toBe(20);
	});

	it("recovery token is a valid UUID format", async () => {
		const cart = await controller.create(makeParams());
		const uuidRegex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		expect(cart.recoveryToken).toMatch(uuidRegex);
	});
});

describe("store endpoints — recover cart", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: AbandonedCartController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAbandonedCartController(mockData);
	});

	// ── Recover: Token Lookup ─────────────────────────────────────────

	it("retrieves active cart by recovery token", async () => {
		const cart = await controller.create(
			makeParams({ email: "alice@example.com", cartTotal: 99.99 }),
		);

		const found = await controller.getByToken(cart.recoveryToken);
		expect(found).not.toBeNull();
		expect(found?.id).toBe(cart.id);
		expect(found?.email).toBe("alice@example.com");
		expect(found?.cartTotal).toBe(99.99);
		expect(found?.items).toHaveLength(2);
		expect(found?.status).toBe("active");
	});

	it("returns null for invalid token", async () => {
		await controller.create(makeParams());
		const found = await controller.getByToken("nonexistent-token");
		expect(found).toBeNull();
	});

	it("returns null for empty token", async () => {
		const found = await controller.getByToken("");
		expect(found).toBeNull();
	});

	// ── Recover: Status Checks ────────────────────────────────────────

	it("returns recovered cart with non-active status", async () => {
		const cart = await controller.create(makeParams());
		await controller.markRecovered(cart.id, "order_123");

		const found = await controller.getByToken(cart.recoveryToken);
		expect(found).not.toBeNull();
		expect(found?.status).toBe("recovered");
		// Endpoint would return 410 for non-active status
	});

	it("returns expired cart with non-active status", async () => {
		const cart = await controller.create(makeParams());
		await controller.markExpired(cart.id);

		const found = await controller.getByToken(cart.recoveryToken);
		expect(found?.status).toBe("expired");
	});

	it("returns dismissed cart with non-active status", async () => {
		const cart = await controller.create(makeParams());
		await controller.dismiss(cart.id);

		const found = await controller.getByToken(cart.recoveryToken);
		expect(found?.status).toBe("dismissed");
	});

	// ── Recover: Token Isolation ──────────────────────────────────────

	it("token from one cart does not retrieve another", async () => {
		const cart1 = await controller.create(makeParams({ email: "a@test.com" }));
		const cart2 = await controller.create(makeParams({ email: "b@test.com" }));

		const found1 = await controller.getByToken(cart1.recoveryToken);
		const found2 = await controller.getByToken(cart2.recoveryToken);

		expect(found1?.email).toBe("a@test.com");
		expect(found2?.email).toBe("b@test.com");
		expect(found1?.id).not.toBe(found2?.id);
	});

	// ── Recover: Cart Data Preservation ───────────────────────────────

	it("recovery returns full item data", async () => {
		const items: CartItemSnapshot[] = [
			{
				productId: "shoe_1",
				variantId: "size_10",
				name: "Running Shoes",
				sku: "RS-010",
				price: 129.99,
				quantity: 1,
				imageUrl: "https://example.com/shoes.jpg",
			},
			{
				productId: "sock_1",
				name: "Athletic Socks",
				price: 12.99,
				quantity: 3,
			},
		];

		const cart = await controller.create(
			makeParams({ items, cartTotal: 168.96 }),
		);

		const found = await controller.getByToken(cart.recoveryToken);
		expect(found?.items).toHaveLength(2);
		expect(found?.items[0].name).toBe("Running Shoes");
		expect(found?.items[0].variantId).toBe("size_10");
		expect(found?.items[1].name).toBe("Athletic Socks");
		expect(found?.cartTotal).toBe(168.96);
	});

	it("recovery preserves currency", async () => {
		const cart = await controller.create(makeParams({ currency: "GBP" }));
		const found = await controller.getByToken(cart.recoveryToken);
		expect(found?.currency).toBe("GBP");
	});

	it("recovery preserves customer and email", async () => {
		const cart = await controller.create(
			makeParams({
				customerId: "cust_xyz",
				email: "customer@shop.com",
			}),
		);
		const found = await controller.getByToken(cart.recoveryToken);
		expect(found?.customerId).toBe("cust_xyz");
		expect(found?.email).toBe("customer@shop.com");
	});
});
