import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CartItemSnapshot } from "../service";
import { createAbandonedCartController } from "../service-impl";

const sampleItems: CartItemSnapshot[] = [
	{
		productId: "prod_1",
		name: "Blue T-Shirt",
		price: 29.99,
		quantity: 2,
	},
	{
		productId: "prod_2",
		variantId: "var_lg",
		name: "Sneakers (Large)",
		price: 89.99,
		quantity: 1,
	},
];

describe("createAbandonedCartController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAbandonedCartController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAbandonedCartController(mockData);
	});

	// ── create ───────────────────────────────────────────────────────────

	describe("create", () => {
		it("creates an abandoned cart with required fields", async () => {
			const cart = await controller.create({
				cartId: "cart_123",
				items: sampleItems,
				cartTotal: 149.97,
			});
			expect(cart.id).toBeDefined();
			expect(cart.cartId).toBe("cart_123");
			expect(cart.items).toHaveLength(2);
			expect(cart.cartTotal).toBe(149.97);
			expect(cart.currency).toBe("USD");
			expect(cart.status).toBe("active");
			expect(cart.recoveryToken).toBeDefined();
			expect(cart.attemptCount).toBe(0);
		});

		it("creates with optional customer and email", async () => {
			const cart = await controller.create({
				cartId: "cart_456",
				customerId: "cust_1",
				email: "shopper@example.com",
				items: sampleItems,
				cartTotal: 149.97,
				currency: "EUR",
			});
			expect(cart.customerId).toBe("cust_1");
			expect(cart.email).toBe("shopper@example.com");
			expect(cart.currency).toBe("EUR");
		});

		it("generates unique recovery tokens", async () => {
			const cart1 = await controller.create({
				cartId: "cart_a",
				items: sampleItems,
				cartTotal: 50,
			});
			const cart2 = await controller.create({
				cartId: "cart_b",
				items: sampleItems,
				cartTotal: 75,
			});
			expect(cart1.recoveryToken).not.toBe(cart2.recoveryToken);
		});
	});

	// ── get ──────────────────────────────────────────────────────────────

	describe("get", () => {
		it("returns an existing cart", async () => {
			const created = await controller.create({
				cartId: "cart_x",
				items: sampleItems,
				cartTotal: 100,
			});
			const found = await controller.get(created.id);
			expect(found?.id).toBe(created.id);
			expect(found?.cartId).toBe("cart_x");
		});

		it("returns null for non-existent cart", async () => {
			const found = await controller.get("missing");
			expect(found).toBeNull();
		});
	});

	// ── getByToken ───────────────────────────────────────────────────────

	describe("getByToken", () => {
		it("finds cart by recovery token", async () => {
			const created = await controller.create({
				cartId: "cart_token",
				items: sampleItems,
				cartTotal: 100,
			});
			const found = await controller.getByToken(created.recoveryToken);
			expect(found?.id).toBe(created.id);
		});

		it("returns null for invalid token", async () => {
			const found = await controller.getByToken("bad-token");
			expect(found).toBeNull();
		});
	});

	// ── getByCartId ──────────────────────────────────────────────────────

	describe("getByCartId", () => {
		it("finds cart by cart ID", async () => {
			const created = await controller.create({
				cartId: "cart_lookup",
				items: sampleItems,
				cartTotal: 100,
			});
			const found = await controller.getByCartId("cart_lookup");
			expect(found?.id).toBe(created.id);
		});

		it("returns null for unknown cart ID", async () => {
			const found = await controller.getByCartId("unknown");
			expect(found).toBeNull();
		});
	});

	// ── list ─────────────────────────────────────────────────────────────

	describe("list", () => {
		it("lists all abandoned carts", async () => {
			await controller.create({
				cartId: "c1",
				items: sampleItems,
				cartTotal: 50,
			});
			await controller.create({
				cartId: "c2",
				items: sampleItems,
				cartTotal: 75,
			});
			const all = await controller.list();
			expect(all).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.create({
				cartId: "c_active",
				items: sampleItems,
				cartTotal: 50,
			});
			const expiredCart = await controller.create({
				cartId: "c_expired",
				items: sampleItems,
				cartTotal: 75,
			});
			await controller.markExpired(expiredCart.id);

			const active = await controller.list({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].cartId).toBe("c_active");
		});

		it("filters by email", async () => {
			await controller.create({
				cartId: "c_email1",
				email: "alice@example.com",
				items: sampleItems,
				cartTotal: 50,
			});
			await controller.create({
				cartId: "c_email2",
				email: "bob@example.com",
				items: sampleItems,
				cartTotal: 75,
			});

			const alice = await controller.list({ email: "alice@example.com" });
			expect(alice).toHaveLength(1);
			expect(alice[0].email).toBe("alice@example.com");
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create({
					cartId: `c_page_${i}`,
					items: sampleItems,
					cartTotal: i * 10,
				});
			}
			const page = await controller.list({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// ── markRecovered ────────────────────────────────────────────────────

	describe("markRecovered", () => {
		it("marks cart as recovered with order ID", async () => {
			const cart = await controller.create({
				cartId: "c_recover",
				items: sampleItems,
				cartTotal: 100,
			});
			const recovered = await controller.markRecovered(cart.id, "order_999");
			expect(recovered?.status).toBe("recovered");
			expect(recovered?.recoveredOrderId).toBe("order_999");
			expect(recovered?.recoveredAt).toBeDefined();
		});

		it("returns null for non-existent cart", async () => {
			const result = await controller.markRecovered("missing", "order_1");
			expect(result).toBeNull();
		});
	});

	// ── markExpired ──────────────────────────────────────────────────────

	describe("markExpired", () => {
		it("marks cart as expired", async () => {
			const cart = await controller.create({
				cartId: "c_expire",
				items: sampleItems,
				cartTotal: 100,
			});
			const expired = await controller.markExpired(cart.id);
			expect(expired?.status).toBe("expired");
		});

		it("returns null for non-existent cart", async () => {
			const result = await controller.markExpired("missing");
			expect(result).toBeNull();
		});
	});

	// ── dismiss ──────────────────────────────────────────────────────────

	describe("dismiss", () => {
		it("marks cart as dismissed", async () => {
			const cart = await controller.create({
				cartId: "c_dismiss",
				items: sampleItems,
				cartTotal: 100,
			});
			const dismissed = await controller.dismiss(cart.id);
			expect(dismissed?.status).toBe("dismissed");
		});

		it("returns null for non-existent cart", async () => {
			const result = await controller.dismiss("missing");
			expect(result).toBeNull();
		});
	});

	// ── delete ───────────────────────────────────────────────────────────

	describe("delete", () => {
		it("deletes a cart and its attempts", async () => {
			const cart = await controller.create({
				cartId: "c_delete",
				email: "del@example.com",
				items: sampleItems,
				cartTotal: 100,
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "del@example.com",
			});

			const result = await controller.delete(cart.id);
			expect(result).toBe(true);
			const found = await controller.get(cart.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent cart", async () => {
			const result = await controller.delete("missing");
			expect(result).toBe(false);
		});
	});

	// ── recordAttempt ────────────────────────────────────────────────────

	describe("recordAttempt", () => {
		it("records a recovery attempt", async () => {
			const cart = await controller.create({
				cartId: "c_attempt",
				email: "test@example.com",
				items: sampleItems,
				cartTotal: 100,
			});
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
				subject: "Come back!",
			});

			expect(attempt.id).toBeDefined();
			expect(attempt.channel).toBe("email");
			expect(attempt.recipient).toBe("test@example.com");
			expect(attempt.subject).toBe("Come back!");
			expect(attempt.status).toBe("sent");
		});

		it("increments attempt count on the cart", async () => {
			const cart = await controller.create({
				cartId: "c_count",
				email: "count@example.com",
				items: sampleItems,
				cartTotal: 100,
			});

			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "count@example.com",
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "count@example.com",
			});

			const updated = await controller.get(cart.id);
			expect(updated?.attemptCount).toBe(2);
		});
	});

	// ── updateAttemptStatus ──────────────────────────────────────────────

	describe("updateAttemptStatus", () => {
		it("updates attempt to opened", async () => {
			const cart = await controller.create({
				cartId: "c_opened",
				items: sampleItems,
				cartTotal: 100,
			});
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "open@example.com",
			});

			const updated = await controller.updateAttemptStatus(
				attempt.id,
				"opened",
			);
			expect(updated?.status).toBe("opened");
			expect(updated?.openedAt).toBeDefined();
		});

		it("updates attempt to clicked", async () => {
			const cart = await controller.create({
				cartId: "c_clicked",
				items: sampleItems,
				cartTotal: 100,
			});
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "click@example.com",
			});

			const updated = await controller.updateAttemptStatus(
				attempt.id,
				"clicked",
			);
			expect(updated?.status).toBe("clicked");
			expect(updated?.clickedAt).toBeDefined();
		});

		it("updates attempt to failed", async () => {
			const cart = await controller.create({
				cartId: "c_failed",
				items: sampleItems,
				cartTotal: 100,
			});
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "fail@example.com",
			});

			const updated = await controller.updateAttemptStatus(
				attempt.id,
				"failed",
			);
			expect(updated?.status).toBe("failed");
		});

		it("returns null for non-existent attempt", async () => {
			const result = await controller.updateAttemptStatus("missing", "opened");
			expect(result).toBeNull();
		});
	});

	// ── listAttempts ─────────────────────────────────────────────────────

	describe("listAttempts", () => {
		it("lists attempts for a cart", async () => {
			const cart = await controller.create({
				cartId: "c_list_attempts",
				items: sampleItems,
				cartTotal: 100,
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "a@example.com",
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "sms",
				recipient: "+15551234567",
			});

			const attempts = await controller.listAttempts(cart.id);
			expect(attempts).toHaveLength(2);
		});

		it("returns empty array for cart with no attempts", async () => {
			const cart = await controller.create({
				cartId: "c_no_attempts",
				items: sampleItems,
				cartTotal: 100,
			});
			const attempts = await controller.listAttempts(cart.id);
			expect(attempts).toHaveLength(0);
		});
	});

	// ── getWithAttempts ──────────────────────────────────────────────────

	describe("getWithAttempts", () => {
		it("returns cart with its attempts", async () => {
			const cart = await controller.create({
				cartId: "c_with_attempts",
				items: sampleItems,
				cartTotal: 100,
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "wa@example.com",
			});

			const result = await controller.getWithAttempts(cart.id);
			expect(result?.cartId).toBe("c_with_attempts");
			expect(result?.attempts).toHaveLength(1);
		});

		it("returns null for non-existent cart", async () => {
			const result = await controller.getWithAttempts("missing");
			expect(result).toBeNull();
		});
	});

	// ── getStats ─────────────────────────────────────────────────────────

	describe("getStats", () => {
		it("computes stats across all carts", async () => {
			// 2 active
			await controller.create({
				cartId: "s1",
				items: sampleItems,
				cartTotal: 50,
			});
			await controller.create({
				cartId: "s2",
				items: sampleItems,
				cartTotal: 75,
			});

			// 1 recovered
			const r = await controller.create({
				cartId: "s3",
				items: sampleItems,
				cartTotal: 200,
			});
			await controller.markRecovered(r.id, "order_1");

			// 1 expired
			const e = await controller.create({
				cartId: "s4",
				items: sampleItems,
				cartTotal: 30,
			});
			await controller.markExpired(e.id);

			const stats = await controller.getStats();
			expect(stats.totalAbandoned).toBe(2);
			expect(stats.totalRecovered).toBe(1);
			expect(stats.totalExpired).toBe(1);
			expect(stats.totalDismissed).toBe(0);
			expect(stats.recoveryRate).toBeCloseTo(0.25);
			expect(stats.totalRecoveredValue).toBe(200);
		});

		it("returns zero stats when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalAbandoned).toBe(0);
			expect(stats.totalRecovered).toBe(0);
			expect(stats.recoveryRate).toBe(0);
			expect(stats.totalRecoveredValue).toBe(0);
		});
	});

	// ── countAll ─────────────────────────────────────────────────────────

	describe("countAll", () => {
		it("counts all carts", async () => {
			await controller.create({
				cartId: "cnt1",
				items: sampleItems,
				cartTotal: 50,
			});
			await controller.create({
				cartId: "cnt2",
				items: sampleItems,
				cartTotal: 75,
			});
			const count = await controller.countAll();
			expect(count).toBe(2);
		});

		it("returns 0 when no carts exist", async () => {
			const count = await controller.countAll();
			expect(count).toBe(0);
		});
	});

	// ── bulkExpire ───────────────────────────────────────────────────────

	describe("bulkExpire", () => {
		it("expires carts older than N days", async () => {
			// Create a cart and manually set its abandonedAt to 40 days ago
			const cart = await controller.create({
				cartId: "old_cart",
				items: sampleItems,
				cartTotal: 100,
			});

			// Simulate old date by re-upserting
			const old = new Date();
			old.setDate(old.getDate() - 40);
			await mockData.upsert("abandonedCart", cart.id, {
				...cart,
				abandonedAt: old,
			} as Record<string, unknown>);

			// Create a recent cart
			await controller.create({
				cartId: "new_cart",
				items: sampleItems,
				cartTotal: 50,
			});

			const expired = await controller.bulkExpire(30);
			expect(expired).toBe(1);

			const oldCart = await controller.get(cart.id);
			expect(oldCart?.status).toBe("expired");
		});

		it("does not expire already recovered carts", async () => {
			const cart = await controller.create({
				cartId: "recovered_cart",
				items: sampleItems,
				cartTotal: 100,
			});
			await controller.markRecovered(cart.id, "order_1");

			// Simulate old date
			const old = new Date();
			old.setDate(old.getDate() - 40);
			const recovered = await controller.get(cart.id);
			await mockData.upsert("abandonedCart", cart.id, {
				...recovered,
				abandonedAt: old,
			} as Record<string, unknown>);

			const expired = await controller.bulkExpire(30);
			expect(expired).toBe(0);
		});

		it("returns 0 when no carts qualify", async () => {
			await controller.create({
				cartId: "fresh",
				items: sampleItems,
				cartTotal: 50,
			});
			const expired = await controller.bulkExpire(30);
			expect(expired).toBe(0);
		});
	});
});
