import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CartItemSnapshot } from "../service";
import { createAbandonedCartController } from "../service-impl";

const sampleItems: CartItemSnapshot[] = [
	{ productId: "prod_1", name: "T-Shirt", price: 29.99, quantity: 2 },
];

describe("abandoned-carts controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAbandonedCartController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAbandonedCartController(mockData);
	});

	// ── updateAttemptStatus edge cases ─────────────────────────────────

	describe("updateAttemptStatus — edge cases", () => {
		it("updates attempt to delivered status", async () => {
			const cart = await controller.create({
				cartId: "c1",
				items: sampleItems,
				cartTotal: 50,
			});
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
			});

			const updated = await controller.updateAttemptStatus(
				attempt.id,
				"delivered",
			);
			expect(updated?.status).toBe("delivered");
		});

		it("does not overwrite openedAt on repeated open", async () => {
			const cart = await controller.create({
				cartId: "c1",
				items: sampleItems,
				cartTotal: 50,
			});
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
			});

			const first = await controller.updateAttemptStatus(attempt.id, "opened");
			const firstOpenedAt = first?.openedAt;
			expect(firstOpenedAt).toBeDefined();

			const second = await controller.updateAttemptStatus(attempt.id, "opened");
			// openedAt should not be overwritten
			expect(second?.openedAt).toEqual(firstOpenedAt);
		});

		it("does not overwrite clickedAt on repeated click", async () => {
			const cart = await controller.create({
				cartId: "c1",
				items: sampleItems,
				cartTotal: 50,
			});
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
			});

			const first = await controller.updateAttemptStatus(attempt.id, "clicked");
			const firstClickedAt = first?.clickedAt;
			expect(firstClickedAt).toBeDefined();

			const second = await controller.updateAttemptStatus(
				attempt.id,
				"clicked",
			);
			expect(second?.clickedAt).toEqual(firstClickedAt);
		});
	});

	// ── Status transitions ────────────────────────────────────────────

	describe("status transitions", () => {
		it("transitions active → expired → stays expired on markRecovered", async () => {
			const cart = await controller.create({
				cartId: "c1",
				items: sampleItems,
				cartTotal: 100,
			});
			await controller.markExpired(cart.id);
			// markRecovered works on any existing cart (no status check)
			const recovered = await controller.markRecovered(cart.id, "ord_1");
			expect(recovered?.status).toBe("recovered");
		});

		it("transitions active → dismissed", async () => {
			const cart = await controller.create({
				cartId: "c1",
				items: sampleItems,
				cartTotal: 100,
			});
			const dismissed = await controller.dismiss(cart.id);
			expect(dismissed?.status).toBe("dismissed");
		});

		it("preserves cart data after status change", async () => {
			const cart = await controller.create({
				cartId: "c1",
				email: "test@example.com",
				items: sampleItems,
				cartTotal: 100,
				currency: "EUR",
			});
			const recovered = await controller.markRecovered(cart.id, "ord_1");
			expect(recovered?.email).toBe("test@example.com");
			expect(recovered?.cartTotal).toBe(100);
			expect(recovered?.currency).toBe("EUR");
			expect(recovered?.items).toHaveLength(1);
		});
	});

	// ── Delete with multiple attempts ─────────────────────────────────

	describe("delete — cleanup", () => {
		it("deletes all recovery attempts when cart is deleted", async () => {
			const cart = await controller.create({
				cartId: "c1",
				email: "test@example.com",
				items: sampleItems,
				cartTotal: 100,
			});

			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "sms",
				recipient: "+15551234567",
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
				subject: "Final reminder",
			});

			const result = await controller.delete(cart.id);
			expect(result).toBe(true);

			const attempts = await controller.listAttempts(cart.id);
			expect(attempts).toHaveLength(0);
		});
	});

	// ── Stats with all statuses ───────────────────────────────────────

	describe("getStats — all statuses", () => {
		it("correctly counts dismissed carts", async () => {
			const c1 = await controller.create({
				cartId: "c1",
				items: sampleItems,
				cartTotal: 50,
			});
			await controller.dismiss(c1.id);

			const stats = await controller.getStats();
			expect(stats.totalDismissed).toBe(1);
			expect(stats.totalAbandoned).toBe(0);
		});

		it("recovery rate considers all statuses", async () => {
			// 1 active, 1 recovered, 1 expired, 1 dismissed = 4 total
			await controller.create({
				cartId: "active",
				items: sampleItems,
				cartTotal: 25,
			});

			const r = await controller.create({
				cartId: "recovered",
				items: sampleItems,
				cartTotal: 100,
			});
			await controller.markRecovered(r.id, "ord_1");

			const e = await controller.create({
				cartId: "expired",
				items: sampleItems,
				cartTotal: 30,
			});
			await controller.markExpired(e.id);

			const d = await controller.create({
				cartId: "dismissed",
				items: sampleItems,
				cartTotal: 15,
			});
			await controller.dismiss(d.id);

			const stats = await controller.getStats();
			expect(stats.totalAbandoned).toBe(1);
			expect(stats.totalRecovered).toBe(1);
			expect(stats.totalExpired).toBe(1);
			expect(stats.totalDismissed).toBe(1);
			expect(stats.recoveryRate).toBeCloseTo(0.25); // 1/4
			expect(stats.totalRecoveredValue).toBe(100);
		});
	});

	// ── Listing edge cases ────────────────────────────────────────────

	describe("list — combined filters", () => {
		it("returns empty when no carts match combined filter", async () => {
			await controller.create({
				cartId: "c1",
				email: "alice@example.com",
				items: sampleItems,
				cartTotal: 50,
			});

			const result = await controller.list({
				email: "bob@example.com",
				status: "active",
			});
			expect(result).toHaveLength(0);
		});

		it("returns empty for empty store", async () => {
			const result = await controller.list();
			expect(result).toHaveLength(0);
		});
	});

	// ── Recovery attempt channels ─────────────────────────────────────

	describe("recordAttempt — channels", () => {
		it("records sms channel attempt", async () => {
			const cart = await controller.create({
				cartId: "c1",
				items: sampleItems,
				cartTotal: 50,
			});

			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "sms",
				recipient: "+15551234567",
			});
			expect(attempt.channel).toBe("sms");
			expect(attempt.recipient).toBe("+15551234567");
		});

		it("attempt without subject stores undefined", async () => {
			const cart = await controller.create({
				cartId: "c1",
				items: sampleItems,
				cartTotal: 50,
			});

			const attempt = await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
			});
			expect(attempt.subject).toBeUndefined();
		});
	});

	// ── bulkExpire edge cases ─────────────────────────────────────────

	describe("bulkExpire — edge cases", () => {
		it("does not expire dismissed carts", async () => {
			const cart = await controller.create({
				cartId: "dismissed_old",
				items: sampleItems,
				cartTotal: 100,
			});
			await controller.dismiss(cart.id);

			// Set old date
			const old = new Date();
			old.setDate(old.getDate() - 40);
			const dismissed = await controller.get(cart.id);
			await mockData.upsert("abandonedCart", cart.id, {
				...dismissed,
				abandonedAt: old,
			} as Record<string, unknown>);

			const expired = await controller.bulkExpire(30);
			expect(expired).toBe(0);
		});

		it("expires multiple old active carts", async () => {
			const old = new Date();
			old.setDate(old.getDate() - 40);

			for (let i = 0; i < 3; i++) {
				const cart = await controller.create({
					cartId: `old_${i}`,
					items: sampleItems,
					cartTotal: 50,
				});
				await mockData.upsert("abandonedCart", cart.id, {
					...cart,
					abandonedAt: old,
				} as Record<string, unknown>);
			}

			const expired = await controller.bulkExpire(30);
			expect(expired).toBe(3);
		});
	});

	// ── getWithAttempts edge cases ────────────────────────────────────

	describe("getWithAttempts — edge cases", () => {
		it("returns cart with multiple attempts in correct order", async () => {
			const cart = await controller.create({
				cartId: "multi",
				email: "test@example.com",
				items: sampleItems,
				cartTotal: 100,
			});

			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "test@example.com",
				subject: "First",
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "sms",
				recipient: "+15551234567",
			});

			const result = await controller.getWithAttempts(cart.id);
			expect(result?.attempts).toHaveLength(2);
			expect(result?.cartId).toBe("multi");
		});
	});
});
