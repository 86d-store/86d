import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateAbandonedCartParams } from "../service";
import {
	createAbandonedCartController,
	type EventEmitter,
} from "../service-impl";

/**
 * Tests for:
 * - Module options enforcement (maxRecoveryAttempts, expirationDays)
 * - Event emissions from controller status transitions
 * - getOptions() returning resolved configuration
 */

function makeParams(
	overrides: Partial<CreateAbandonedCartParams> = {},
): CreateAbandonedCartParams {
	return {
		cartId: `cart_${crypto.randomUUID().slice(0, 8)}`,
		items: [{ productId: "p1", name: "Widget", price: 25, quantity: 1 }],
		cartTotal: 25,
		...overrides,
	};
}

describe("controller options", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	// ── getOptions ────────────────────────────────────────────────────

	describe("getOptions", () => {
		it("returns default options when none provided", () => {
			const controller = createAbandonedCartController(mockData);
			const opts = controller.getOptions();
			expect(opts.maxRecoveryAttempts).toBe(3);
			expect(opts.expirationDays).toBe(30);
			expect(opts.abandonmentThresholdMinutes).toBe(60);
		});

		it("returns custom options when provided", () => {
			const controller = createAbandonedCartController(mockData, {
				maxRecoveryAttempts: 5,
				expirationDays: 14,
				abandonmentThresholdMinutes: 30,
			});
			const opts = controller.getOptions();
			expect(opts.maxRecoveryAttempts).toBe(5);
			expect(opts.expirationDays).toBe(14);
			expect(opts.abandonmentThresholdMinutes).toBe(30);
		});

		it("merges partial options with defaults", () => {
			const controller = createAbandonedCartController(mockData, {
				maxRecoveryAttempts: 10,
			});
			const opts = controller.getOptions();
			expect(opts.maxRecoveryAttempts).toBe(10);
			expect(opts.expirationDays).toBe(30); // default
			expect(opts.abandonmentThresholdMinutes).toBe(60); // default
		});

		it("returns a copy — mutation does not affect internal state", () => {
			const controller = createAbandonedCartController(mockData);
			const opts = controller.getOptions();
			opts.maxRecoveryAttempts = 999;
			expect(controller.getOptions().maxRecoveryAttempts).toBe(3);
		});
	});

	// ── maxRecoveryAttempts enforcement ────────────────────────────────

	describe("maxRecoveryAttempts", () => {
		it("allows attempts up to the limit", async () => {
			const controller = createAbandonedCartController(mockData, {
				maxRecoveryAttempts: 2,
			});
			const cart = await controller.create(makeParams());

			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "a@test.com",
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "sms",
				recipient: "+1234567890",
			});

			const updated = await controller.get(cart.id);
			expect(updated?.attemptCount).toBe(2);
		});

		it("rejects attempt when limit is reached", async () => {
			const controller = createAbandonedCartController(mockData, {
				maxRecoveryAttempts: 2,
			});
			const cart = await controller.create(makeParams());

			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "a@test.com",
			});
			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "a@test.com",
			});

			await expect(
				controller.recordAttempt({
					abandonedCartId: cart.id,
					channel: "email",
					recipient: "a@test.com",
				}),
			).rejects.toThrow("Maximum recovery attempts (2) reached");
		});

		it("enforces default limit of 3", async () => {
			const controller = createAbandonedCartController(mockData);
			const cart = await controller.create(makeParams());

			for (let i = 0; i < 3; i++) {
				await controller.recordAttempt({
					abandonedCartId: cart.id,
					channel: "email",
					recipient: "a@test.com",
				});
			}

			await expect(
				controller.recordAttempt({
					abandonedCartId: cart.id,
					channel: "email",
					recipient: "a@test.com",
				}),
			).rejects.toThrow("Maximum recovery attempts (3) reached");
		});

		it("limit of 1 allows only a single attempt", async () => {
			const controller = createAbandonedCartController(mockData, {
				maxRecoveryAttempts: 1,
			});
			const cart = await controller.create(makeParams());

			await controller.recordAttempt({
				abandonedCartId: cart.id,
				channel: "email",
				recipient: "a@test.com",
			});

			await expect(
				controller.recordAttempt({
					abandonedCartId: cart.id,
					channel: "sms",
					recipient: "+1234567890",
				}),
			).rejects.toThrow("Maximum recovery attempts (1) reached");
		});

		it("different carts have independent attempt limits", async () => {
			const controller = createAbandonedCartController(mockData, {
				maxRecoveryAttempts: 1,
			});
			const cart1 = await controller.create(makeParams());
			const cart2 = await controller.create(makeParams());

			await controller.recordAttempt({
				abandonedCartId: cart1.id,
				channel: "email",
				recipient: "a@test.com",
			});

			// cart1 is maxed out
			await expect(
				controller.recordAttempt({
					abandonedCartId: cart1.id,
					channel: "email",
					recipient: "a@test.com",
				}),
			).rejects.toThrow("Maximum recovery attempts");

			// cart2 still has room
			const attempt = await controller.recordAttempt({
				abandonedCartId: cart2.id,
				channel: "email",
				recipient: "b@test.com",
			});
			expect(attempt.id).toBeDefined();
		});
	});

	// ── expirationDays (bulkExpire default) ───────────────────────────

	describe("expirationDays", () => {
		it("bulkExpire uses configured expirationDays as default", async () => {
			const controller = createAbandonedCartController(mockData, {
				expirationDays: 7,
			});

			const cart = await controller.create(makeParams());

			// Backdate to 8 days ago
			const old = await controller.get(cart.id);
			const eightDaysAgo = new Date();
			eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
			await mockData.upsert("abandonedCart", cart.id, {
				...old,
				abandonedAt: eightDaysAgo,
			} as Record<string, unknown>);

			// bulkExpire() with no args should use expirationDays=7
			const expired = await controller.bulkExpire();
			expect(expired).toBe(1);

			const updated = await controller.get(cart.id);
			expect(updated?.status).toBe("expired");
		});

		it("bulkExpire override takes precedence over config", async () => {
			const controller = createAbandonedCartController(mockData, {
				expirationDays: 7,
			});

			const cart = await controller.create(makeParams());

			// Backdate to 5 days ago (within 7 days but beyond 3 days)
			const old = await controller.get(cart.id);
			const fiveDaysAgo = new Date();
			fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
			await mockData.upsert("abandonedCart", cart.id, {
				...old,
				abandonedAt: fiveDaysAgo,
			} as Record<string, unknown>);

			// Explicit override: 3 days
			const expired = await controller.bulkExpire(3);
			expect(expired).toBe(1);
		});

		it("bulkExpire with no args and default config uses 30 days", async () => {
			const controller = createAbandonedCartController(mockData);

			const cart = await controller.create(makeParams());

			// Backdate to 15 days ago — within 30-day default
			const old = await controller.get(cart.id);
			const fifteenDaysAgo = new Date();
			fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
			await mockData.upsert("abandonedCart", cart.id, {
				...old,
				abandonedAt: fifteenDaysAgo,
			} as Record<string, unknown>);

			const expired = await controller.bulkExpire();
			expect(expired).toBe(0); // 15 < 30, not old enough
		});
	});
});

describe("controller event emissions", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let mockEvents: EventEmitter;

	beforeEach(() => {
		mockData = createMockDataService();
		mockEvents = {
			emit: vi.fn().mockResolvedValue(undefined),
		};
	});

	// ── cart.recovered ────────────────────────────────────────────────

	describe("markRecovered emits cart.recovered", () => {
		it("emits with cart and order details", async () => {
			const controller = createAbandonedCartController(
				mockData,
				{},
				mockEvents,
			);
			const cart = await controller.create(
				makeParams({
					email: "alice@test.com",
					cartTotal: 99.99,
					currency: "EUR",
				}),
			);

			await controller.markRecovered(cart.id, "order_abc");

			expect(mockEvents.emit).toHaveBeenCalledWith("cart.recovered", {
				cartId: cart.id,
				orderId: "order_abc",
				email: "alice@test.com",
				cartTotal: 99.99,
				currency: "EUR",
			});
		});

		it("does not emit when cart not found", async () => {
			const controller = createAbandonedCartController(
				mockData,
				{},
				mockEvents,
			);

			await controller.markRecovered("nonexistent", "order_1");
			expect(mockEvents.emit).not.toHaveBeenCalled();
		});
	});

	// ── cart.expired ──────────────────────────────────────────────────

	describe("markExpired emits cart.expired", () => {
		it("emits with cart details", async () => {
			const controller = createAbandonedCartController(
				mockData,
				{},
				mockEvents,
			);
			const cart = await controller.create(
				makeParams({
					email: "bob@test.com",
					cartTotal: 50,
				}),
			);

			await controller.markExpired(cart.id);

			expect(mockEvents.emit).toHaveBeenCalledWith("cart.expired", {
				cartId: cart.id,
				email: "bob@test.com",
				cartTotal: 50,
			});
		});

		it("does not emit when cart not found", async () => {
			const controller = createAbandonedCartController(
				mockData,
				{},
				mockEvents,
			);

			await controller.markExpired("nonexistent");
			expect(mockEvents.emit).not.toHaveBeenCalled();
		});
	});

	// ── cart.dismissed ────────────────────────────────────────────────

	describe("dismiss emits cart.dismissed", () => {
		it("emits with cart details", async () => {
			const controller = createAbandonedCartController(
				mockData,
				{},
				mockEvents,
			);
			const cart = await controller.create(
				makeParams({
					email: "carol@test.com",
					cartTotal: 200,
				}),
			);

			await controller.dismiss(cart.id);

			expect(mockEvents.emit).toHaveBeenCalledWith("cart.dismissed", {
				cartId: cart.id,
				email: "carol@test.com",
				cartTotal: 200,
			});
		});

		it("does not emit when cart not found", async () => {
			const controller = createAbandonedCartController(
				mockData,
				{},
				mockEvents,
			);

			await controller.dismiss("nonexistent");
			expect(mockEvents.emit).not.toHaveBeenCalled();
		});
	});

	// ── No event emitter (graceful no-op) ─────────────────────────────

	describe("no event emitter provided", () => {
		it("controller works without events (no-op fallback)", async () => {
			const controller = createAbandonedCartController(mockData);
			const cart = await controller.create(makeParams());

			// These should not throw even without an event emitter
			await controller.markRecovered(cart.id, "order_1");
			const recovered = await controller.get(cart.id);
			expect(recovered?.status).toBe("recovered");
		});
	});

	// ── bulkExpire emits per-cart events ──────────────────────────────

	describe("bulkExpire emits cart.expired for each expired cart", () => {
		it("emits event for each cart expired by bulkExpire", async () => {
			const controller = createAbandonedCartController(
				mockData,
				{ expirationDays: 5 },
				mockEvents,
			);

			const cart1 = await controller.create(
				makeParams({ email: "a@test.com", cartTotal: 100 }),
			);
			const cart2 = await controller.create(
				makeParams({ email: "b@test.com", cartTotal: 200 }),
			);
			// cart3 is recent — should not be expired
			await controller.create(makeParams({ email: "c@test.com" }));

			// Backdate cart1 and cart2 to 10 days ago
			const tenDaysAgo = new Date();
			tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

			for (const cartId of [cart1.id, cart2.id]) {
				const old = await controller.get(cartId);
				await mockData.upsert("abandonedCart", cartId, {
					...old,
					abandonedAt: tenDaysAgo,
				} as Record<string, unknown>);
			}

			const expiredCount = await controller.bulkExpire();
			expect(expiredCount).toBe(2);

			// Verify events emitted for each expired cart
			expect(mockEvents.emit).toHaveBeenCalledWith("cart.expired", {
				cartId: cart1.id,
				email: "a@test.com",
				cartTotal: 100,
			});
			expect(mockEvents.emit).toHaveBeenCalledWith("cart.expired", {
				cartId: cart2.id,
				email: "b@test.com",
				cartTotal: 200,
			});
			// cart3 should not have an event
			expect(mockEvents.emit).toHaveBeenCalledTimes(2);
		});
	});
});
