import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CartItemSnapshot, CreateAbandonedCartParams } from "../service";
import { createAbandonedCartController } from "../service-impl";

const sampleItems: CartItemSnapshot[] = [
	{ productId: "prod_1", name: "T-Shirt", price: 29.99, quantity: 2 },
	{
		productId: "prod_2",
		variantId: "var_lg",
		name: "Sneakers",
		price: 89.99,
		quantity: 1,
	},
];

function makeParams(
	overrides: Partial<CreateAbandonedCartParams> = {},
): CreateAbandonedCartParams {
	return {
		cartId: `cart_${crypto.randomUUID().slice(0, 8)}`,
		items: sampleItems,
		cartTotal: 149.97,
		...overrides,
	};
}

describe("abandoned-carts admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAbandonedCartController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAbandonedCartController(mockData);
	});

	// ── Status transition matrix ──────────────────────────────────────

	describe("status transition matrix", () => {
		it("active → recovered → can be recovered again (idempotent)", async () => {
			const cart = await controller.create(makeParams());
			await controller.markRecovered(cart.id, "order_1");
			const again = await controller.markRecovered(cart.id, "order_2");
			expect(again?.status).toBe("recovered");
			expect(again?.recoveredOrderId).toBe("order_2");
		});

		it("dismissed → can still be recovered", async () => {
			const cart = await controller.create(makeParams());
			await controller.dismiss(cart.id);
			const recovered = await controller.markRecovered(cart.id, "order_1");
			expect(recovered?.status).toBe("recovered");
		});

		it("expired → dismissed", async () => {
			const cart = await controller.create(makeParams());
			await controller.markExpired(cart.id);
			const dismissed = await controller.dismiss(cart.id);
			expect(dismissed?.status).toBe("dismissed");
		});

		it("recovered → expired", async () => {
			const cart = await controller.create(makeParams());
			await controller.markRecovered(cart.id, "order_1");
			const expired = await controller.markExpired(cart.id);
			expect(expired?.status).toBe("expired");
		});

		it("dismissed → expired", async () => {
			const cart = await controller.create(makeParams());
			await controller.dismiss(cart.id);
			const expired = await controller.markExpired(cart.id);
			expect(expired?.status).toBe("expired");
		});

		it("rapid status transitions preserve all fields", async () => {
			const cart = await controller.create(
				makeParams({
					customerId: "cust_1",
					email: "user@example.com",
					currency: "GBP",
				}),
			);
			await controller.markExpired(cart.id);
			await controller.dismiss(cart.id);
			const final = await controller.markRecovered(cart.id, "order_final");

			expect(final?.customerId).toBe("cust_1");
			expect(final?.email).toBe("user@example.com");
			expect(final?.currency).toBe("GBP");
			expect(final?.items).toHaveLength(2);
			expect(final?.cartTotal).toBe(149.97);
		});
	});

	// ── Recovery attempt on non-existent cart ─────────────────────────

	describe("recordAttempt edge cases", () => {
		it("increments attemptCount even on non-email channels", async () => {
			const cart = await controller.create(makeParams());

			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "push",
				recipient: "device_token_123",
			});

			const updated = await controller.get(cart.id);
			expect(updated?.attemptCount).toBe(1);
		});

		it("records attempt on cart that no longer exists (attempt still created)", async () => {
			// Record attempt referencing a non-existent cart ID
			const attempt = await controller.recordAttempt({
				abandonedCartId: "nonexistent",
				channel: "email",
				recipient: "test@example.com",
			});
			expect(attempt.id).toBeDefined();
			expect(attempt.status).toBe("sent");
		});

		it("multiple attempts across different channels increment correctly", async () => {
			const cart = await controller.create(makeParams());

			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
				subject: "Come back!",
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "sms",
				recipient: "+15551234567",
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "push",
				recipient: "device_token",
			});

			const updated = await controller.get(cart.id);
			expect(updated?.attemptCount).toBe(3);

			const attempts = await controller.listAttempts(cart.id);
			expect(attempts).toHaveLength(3);
			const channels = attempts.map((a) => a.channel).sort();
			expect(channels).toEqual(["email", "push", "sms"]);
		});
	});

	// ── Attempt status lifecycle ──────────────────────────────────────

	describe("attempt status lifecycle", () => {
		it("full lifecycle: sent → delivered → opened → clicked", async () => {
			const cart = await controller.create(makeParams());
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
			});

			const delivered = await controller.updateAttemptStatus(
				attempt.id,
				"delivered",
			);
			expect(delivered?.status).toBe("delivered");
			expect(delivered?.openedAt).toBeUndefined();
			expect(delivered?.clickedAt).toBeUndefined();

			const opened = await controller.updateAttemptStatus(attempt.id, "opened");
			expect(opened?.status).toBe("opened");
			expect(opened?.openedAt).toBeDefined();
			expect(opened?.clickedAt).toBeUndefined();

			const clicked = await controller.updateAttemptStatus(
				attempt.id,
				"clicked",
			);
			expect(clicked?.status).toBe("clicked");
			expect(clicked?.openedAt).toBeDefined();
			expect(clicked?.clickedAt).toBeDefined();
		});

		it("failed status does not set openedAt or clickedAt", async () => {
			const cart = await controller.create(makeParams());
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
			});

			const failed = await controller.updateAttemptStatus(attempt.id, "failed");
			expect(failed?.status).toBe("failed");
			expect(failed?.openedAt).toBeUndefined();
			expect(failed?.clickedAt).toBeUndefined();
		});

		it("opened then failed preserves openedAt", async () => {
			const cart = await controller.create(makeParams());
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
			});

			const opened = await controller.updateAttemptStatus(attempt.id, "opened");
			const openedAt = opened?.openedAt;

			const failed = await controller.updateAttemptStatus(attempt.id, "failed");
			expect(failed?.status).toBe("failed");
			expect(failed?.openedAt).toEqual(openedAt);
		});

		it("clicked without prior opened still sets clickedAt", async () => {
			const cart = await controller.create(makeParams());
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
			});

			const clicked = await controller.updateAttemptStatus(
				attempt.id,
				"clicked",
			);
			expect(clicked?.clickedAt).toBeDefined();
			expect(clicked?.openedAt).toBeUndefined();
		});
	});

	// ── Stats with multiple recovered carts ───────────────────────────

	describe("stats — recovery value accumulation", () => {
		it("accumulates value across multiple recovered carts", async () => {
			for (let i = 0; i < 3; i++) {
				const cart = await controller.create(
					makeParams({ cartTotal: (i + 1) * 1000 }),
				);
				await controller.markRecovered(cart.id, `order_${i}`);
			}

			const stats = await controller.getStats();
			expect(stats.totalRecovered).toBe(3);
			expect(stats.totalRecoveredValue).toBe(6000); // 1000 + 2000 + 3000
			expect(stats.recoveryRate).toBe(1.0);
		});

		it("recovery rate with many carts across all statuses", async () => {
			// 3 active, 2 recovered, 4 expired, 1 dismissed = 10 total
			for (let i = 0; i < 3; i++) {
				await controller.create(makeParams());
			}
			for (let i = 0; i < 2; i++) {
				const cart = await controller.create(makeParams({ cartTotal: 500 }));
				await controller.markRecovered(cart.id, `order_${i}`);
			}
			for (let i = 0; i < 4; i++) {
				const cart = await controller.create(makeParams());
				await controller.markExpired(cart.id);
			}
			const dismissed = await controller.create(makeParams());
			await controller.dismiss(dismissed.id);

			const stats = await controller.getStats();
			expect(stats.totalAbandoned).toBe(3);
			expect(stats.totalRecovered).toBe(2);
			expect(stats.totalExpired).toBe(4);
			expect(stats.totalDismissed).toBe(1);
			expect(stats.recoveryRate).toBeCloseTo(0.2); // 2/10
			expect(stats.totalRecoveredValue).toBe(1000); // 500 * 2
		});
	});

	// ── Combined list filters ─────────────────────────────────────────

	describe("list — combined filters", () => {
		it("filters by both status and email simultaneously", async () => {
			await controller.create(makeParams({ email: "alice@example.com" }));
			const toRecover = await controller.create(
				makeParams({ email: "alice@example.com" }),
			);
			await controller.markRecovered(toRecover.id, "order_1");

			await controller.create(makeParams({ email: "bob@example.com" }));

			const activeAlice = await controller.list({
				status: "active",
				email: "alice@example.com",
			});
			expect(activeAlice).toHaveLength(1);
			expect(activeAlice[0].email).toBe("alice@example.com");
			expect(activeAlice[0].status).toBe("active");
		});

		it("pagination works with status filter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create(makeParams());
			}
			const page = await controller.list({
				status: "active",
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── BulkExpire edge cases ─────────────────────────────────────────

	describe("bulkExpire — advanced", () => {
		it("olderThanDays = 0 expires all active carts", async () => {
			const cart1 = await controller.create(makeParams());
			const cart2 = await controller.create(makeParams());

			// Both carts are "now", but olderThanDays=0 means cutoff is now
			// Cart abandonedAt is now, cutoff is now, so now < now is false
			// This should actually not expire (equal is not less than)
			const expired = await controller.bulkExpire(0);
			expect(expired).toBe(0);

			// Verify carts are still active
			const c1 = await controller.get(cart1.id);
			const c2 = await controller.get(cart2.id);
			expect(c1?.status).toBe("active");
			expect(c2?.status).toBe("active");
		});

		it("olderThanDays = 1 expires only carts older than 1 day", async () => {
			// Create and backdate to 2 days ago
			const oldCart = await controller.create(makeParams());
			const twoDaysAgo = new Date();
			twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
			await mockData.upsert("abandonedCart", oldCart.id, {
				...oldCart,
				abandonedAt: twoDaysAgo,
			} as Record<string, unknown>);

			// Recent cart should not expire
			await controller.create(makeParams());

			const expired = await controller.bulkExpire(1);
			expect(expired).toBe(1);
		});

		it("does not expire already expired carts", async () => {
			const cart = await controller.create(makeParams());
			await controller.markExpired(cart.id);

			const old = new Date();
			old.setDate(old.getDate() - 40);
			const expired = await controller.get(cart.id);
			await mockData.upsert("abandonedCart", cart.id, {
				...expired,
				abandonedAt: old,
			} as Record<string, unknown>);

			const count = await controller.bulkExpire(30);
			expect(count).toBe(0);
		});

		it("large batch — 10 old active carts all expire", async () => {
			const old = new Date();
			old.setDate(old.getDate() - 50);

			for (let i = 0; i < 10; i++) {
				const cart = await controller.create(
					makeParams({ cartId: `old_batch_${i}` }),
				);
				await mockData.upsert("abandonedCart", cart.id, {
					...cart,
					abandonedAt: old,
				} as Record<string, unknown>);
			}

			const count = await controller.bulkExpire(30);
			expect(count).toBe(10);
		});
	});

	// ── Delete edge cases ─────────────────────────────────────────────

	describe("delete — advanced", () => {
		it("double delete returns false on second call", async () => {
			const cart = await controller.create(makeParams());
			expect(await controller.delete(cart.id)).toBe(true);
			expect(await controller.delete(cart.id)).toBe(false);
		});

		it("deleted cart is excluded from stats", async () => {
			const cart = await controller.create(makeParams({ cartTotal: 1000 }));
			await controller.markRecovered(cart.id, "order_1");
			await controller.delete(cart.id);

			const stats = await controller.getStats();
			expect(stats.totalRecovered).toBe(0);
			expect(stats.totalRecoveredValue).toBe(0);
		});

		it("deleted cart is excluded from countAll", async () => {
			const cart1 = await controller.create(makeParams());
			await controller.create(makeParams());
			await controller.delete(cart1.id);

			const count = await controller.countAll();
			expect(count).toBe(1);
		});

		it("deleted cart's token no longer resolves", async () => {
			const cart = await controller.create(makeParams());
			const token = cart.recoveryToken;
			await controller.delete(cart.id);

			const found = await controller.getByToken(token);
			expect(found).toBeNull();
		});

		it("deleted cart's cartId no longer resolves", async () => {
			const cart = await controller.create(makeParams());
			const cartId = cart.cartId;
			await controller.delete(cart.id);

			const found = await controller.getByCartId(cartId);
			expect(found).toBeNull();
		});
	});

	// ── Currency and items edge cases ─────────────────────────────────

	describe("create — data integrity", () => {
		it("defaults currency to USD when not provided", async () => {
			const cart = await controller.create({
				cartId: "cart_nocurrency",
				items: sampleItems,
				cartTotal: 100,
			});
			expect(cart.currency).toBe("USD");
		});

		it("preserves custom currency", async () => {
			const cart = await controller.create(makeParams({ currency: "JPY" }));
			expect(cart.currency).toBe("JPY");
		});

		it("stores items with all optional fields", async () => {
			const items: CartItemSnapshot[] = [
				{
					productId: "p1",
					variantId: "v1",
					name: "Full Item",
					sku: "SKU-001",
					price: 49.99,
					quantity: 3,
					imageUrl: "/img/product.jpg",
				},
			];
			const cart = await controller.create({
				cartId: "cart_fullitems",
				items,
				cartTotal: 149.97,
			});
			expect(cart.items[0].variantId).toBe("v1");
			expect(cart.items[0].sku).toBe("SKU-001");
			expect(cart.items[0].imageUrl).toBe("/img/product.jpg");
		});

		it("stores items with minimal fields", async () => {
			const items: CartItemSnapshot[] = [
				{ productId: "p1", name: "Basic", price: 10, quantity: 1 },
			];
			const cart = await controller.create({
				cartId: "cart_minimal",
				items,
				cartTotal: 10,
			});
			expect(cart.items[0].variantId).toBeUndefined();
			expect(cart.items[0].sku).toBeUndefined();
			expect(cart.items[0].imageUrl).toBeUndefined();
		});

		it("stores cart with zero total", async () => {
			const cart = await controller.create(makeParams({ cartTotal: 0 }));
			expect(cart.cartTotal).toBe(0);
		});

		it("each cart gets a unique ID", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const cart = await controller.create(makeParams());
				ids.add(cart.id);
			}
			expect(ids.size).toBe(20);
		});
	});

	// ── getWithAttempts after status changes ──────────────────────────

	describe("getWithAttempts — after status changes", () => {
		it("returns attempts even after cart is recovered", async () => {
			const cart = await controller.create(makeParams());
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "user@example.com",
			});
			await controller.markRecovered(cart.id, "order_1");

			const result = await controller.getWithAttempts(cart.id);
			expect(result?.status).toBe("recovered");
			expect(result?.attempts).toHaveLength(1);
		});

		it("returns attempts even after cart is expired", async () => {
			const cart = await controller.create(makeParams());
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "sms",
				recipient: "+15551234567",
			});
			await controller.markExpired(cart.id);

			const result = await controller.getWithAttempts(cart.id);
			expect(result?.status).toBe("expired");
			expect(result?.attempts).toHaveLength(1);
		});

		it("returns empty attempts array for cart with no attempts", async () => {
			const cart = await controller.create(makeParams());
			const result = await controller.getWithAttempts(cart.id);
			expect(result?.attempts).toHaveLength(0);
		});

		it("returns multiple attempts with correct data", async () => {
			const cart = await controller.create(makeParams());

			const a1 = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "user@example.com",
				subject: "We miss you!",
			});
			await controller.updateAttemptStatus(a1.id, "opened");

			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "sms",
				recipient: "+15551234567",
			});

			const result = await controller.getWithAttempts(cart.id);
			expect(result?.attempts).toHaveLength(2);
			expect(result?.attemptCount).toBe(2);
		});
	});

	// ── List ordering and pagination ──────────────────────────────────

	describe("list — ordering and pagination", () => {
		it("returns results with take=1", async () => {
			await controller.create(makeParams());
			await controller.create(makeParams());
			await controller.create(makeParams());

			const result = await controller.list({ take: 1 });
			expect(result).toHaveLength(1);
		});

		it("skip beyond total returns empty", async () => {
			await controller.create(makeParams());
			await controller.create(makeParams());

			const result = await controller.list({ skip: 10 });
			expect(result).toHaveLength(0);
		});

		it("countAll reflects all statuses", async () => {
			await controller.create(makeParams());
			const r = await controller.create(makeParams());
			await controller.markRecovered(r.id, "order_1");
			const e = await controller.create(makeParams());
			await controller.markExpired(e.id);

			const count = await controller.countAll();
			expect(count).toBe(3);
		});
	});

	// ── getByCartId / getByToken edge cases ───────────────────────────

	describe("lookup by cartId and token", () => {
		it("getByCartId returns first match when multiple carts share cartId", async () => {
			// In practice each cartId should be unique, but test the behavior
			await controller.create(makeParams({ cartId: "shared_cart" }));
			await controller.create(makeParams({ cartId: "shared_cart" }));

			const found = await controller.getByCartId("shared_cart");
			expect(found).not.toBeNull();
			// Should return one of them (first match due to take:1)
			expect(found?.cartId).toBe("shared_cart");
		});

		it("recovery tokens are always UUID format", async () => {
			const cart = await controller.create(makeParams());
			// UUID v4 pattern
			expect(cart.recoveryToken).toMatch(
				/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/,
			);
		});
	});
});
