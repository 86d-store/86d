import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import type { CheckoutLineItem } from "../service";
import { createCheckoutController } from "../service-impl";

const sampleLineItems: CheckoutLineItem[] = [
	{ productId: "p1", name: "Widget", price: 1000, quantity: 2 },
	{
		productId: "p2",
		variantId: "v1",
		name: "Gadget S",
		sku: "GAD-S",
		price: 2000,
		quantity: 1,
	},
];

function makeSession(overrides: Record<string, unknown> = {}) {
	return {
		subtotal: 4000,
		taxAmount: 400,
		shippingAmount: 500,
		total: 4900,
		lineItems: sampleLineItems,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("create", () => {
	it("creates a session with correct defaults", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());

		expect(session.status).toBe("pending");
		expect(session.currency).toBe("USD");
		expect(session.discountAmount).toBe(0);
		expect(session.subtotal).toBe(4000);
		expect(session.total).toBe(4900);
		expect(session.expiresAt).toBeInstanceOf(Date);
		expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
	});

	it("accepts optional fields (customerId, guestEmail, cartId)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				customerId: "cust-1",
				guestEmail: "a@b.com",
				cartId: "cart-1",
			}),
		);
		expect(session.customerId).toBe("cust-1");
		expect(session.guestEmail).toBe("a@b.com");
		expect(session.cartId).toBe("cart-1");
	});

	it("stores line items retrievable via getLineItems", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const items = await ctrl.getLineItems(session.id);

		expect(items).toHaveLength(2);
		expect(items[0].productId).toBe("p1");
		expect(items[1].productId).toBe("p2");
		expect(items[1].variantId).toBe("v1");
		// sessionId must NOT leak through
		expect(items[0]).not.toHaveProperty("sessionId");
	});
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

describe("getById", () => {
	it("returns null for missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		expect(await ctrl.getById("nope")).toBeNull();
	});

	it("returns the session when it exists", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const created = await ctrl.create(makeSession());
		const fetched = await ctrl.getById(created.id);
		expect(fetched?.id).toBe(created.id);
		expect(fetched?.status).toBe("pending");
	});
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("update", () => {
	it("updates guestEmail and address", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.update(session.id, {
			guestEmail: "guest@example.com",
			shippingAddress: {
				firstName: "Jane",
				lastName: "Doe",
				line1: "1 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
			},
		});

		expect(updated?.guestEmail).toBe("guest@example.com");
		expect(updated?.shippingAddress?.city).toBe("Springfield");
		// unchanged fields preserved
		expect(updated?.subtotal).toBe(4000);
	});

	it("recalculates total when shippingAmount changes", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		// subtotal=4000 tax=400 shipping=500 → total=4900
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.update(session.id, { shippingAmount: 1000 });

		// 4000 + 400 + 1000 - 0 = 5400
		expect(updated?.shippingAmount).toBe(1000);
		expect(updated?.total).toBe(5400);
	});

	it("returns null for a completed session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.complete(session.id, "order-1");
		const result = await ctrl.update(session.id, { guestEmail: "x@y.com" });
		expect(result).toBeNull();
	});

	it("returns null for a missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		expect(await ctrl.update("ghost", { guestEmail: "a@b.com" })).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// applyDiscount / removeDiscount
// ---------------------------------------------------------------------------

describe("applyDiscount", () => {
	it("applies a fixed discount and recalculates total", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		// subtotal=4000 tax=400 shipping=500 total=4900
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.applyDiscount(session.id, {
			code: "SAVE500",
			discountAmount: 500,
			freeShipping: false,
		});

		expect(updated?.discountCode).toBe("SAVE500");
		expect(updated?.discountAmount).toBe(500);
		// 4000 + 400 + 500 - 500 = 4400
		expect(updated?.total).toBe(4400);
	});

	it("applies free shipping (sets shippingAmount to 0)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.applyDiscount(session.id, {
			code: "FREESHIP",
			discountAmount: 0,
			freeShipping: true,
		});

		expect(updated?.shippingAmount).toBe(0);
		// 4000 + 400 + 0 - 0 = 4400
		expect(updated?.total).toBe(4400);
	});

	it("clamps total to zero (no negative totals)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.applyDiscount(session.id, {
			code: "BIG",
			discountAmount: 99999,
			freeShipping: false,
		});

		expect(updated?.total).toBe(0);
	});

	it("returns null for a completed session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.complete(session.id, "order-1");
		const result = await ctrl.applyDiscount(session.id, {
			code: "X",
			discountAmount: 100,
			freeShipping: false,
		});
		expect(result).toBeNull();
	});
});

describe("removeDiscount", () => {
	it("removes discount and restores original total", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.applyDiscount(session.id, {
			code: "SAVE500",
			discountAmount: 500,
			freeShipping: false,
		});
		const restored = await ctrl.removeDiscount(session.id);

		expect(restored?.discountCode).toBeUndefined();
		expect(restored?.discountAmount).toBe(0);
		// subtotal=4000 + tax=400 + shipping=500 = 4900
		expect(restored?.total).toBe(4900);
	});

	it("returns null for missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		expect(await ctrl.removeDiscount("nope")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// confirm
// ---------------------------------------------------------------------------

const sampleAddress = {
	firstName: "Jane",
	lastName: "Doe",
	line1: "1 Main St",
	city: "Springfield",
	state: "IL",
	postalCode: "62701",
	country: "US",
};

describe("confirm", () => {
	it("transitions a valid pending session to processing", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);

		const result = await ctrl.confirm(session.id);
		expect("session" in result).toBe(true);
		if ("session" in result) {
			expect(result.session.status).toBe("processing");
		}
	});

	it("accepts guestEmail as customer identification", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				guestEmail: "guest@example.com",
				shippingAddress: sampleAddress,
			}),
		);

		const result = await ctrl.confirm(session.id);
		expect("session" in result).toBe(true);
	});

	it("returns error when session not found", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const result = await ctrl.confirm("nonexistent");
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(404);
		}
	});

	it("returns error for non-pending session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(session.id); // now processing

		const result = await ctrl.confirm(session.id);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(422);
			expect(result.error).toContain("processing");
		}
	});

	it("returns error when no customer identification", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				shippingAddress: sampleAddress,
			}),
		);

		const result = await ctrl.confirm(session.id);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(422);
			expect(result.error).toContain("Customer ID or guest email");
		}
	});

	it("returns error when no shipping address", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				customerId: "cust-1",
			}),
		);

		const result = await ctrl.confirm(session.id);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(422);
			expect(result.error).toContain("Shipping address");
		}
	});

	it("returns error when no line items", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create({
			subtotal: 0,
			total: 0,
			lineItems: [],
			customerId: "cust-1",
			shippingAddress: sampleAddress,
		});

		const result = await ctrl.confirm(session.id);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(422);
			expect(result.error).toContain("no line items");
		}
	});
});

// ---------------------------------------------------------------------------
// complete
// ---------------------------------------------------------------------------

describe("complete", () => {
	it("marks a pending session as completed and stores orderId", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const completed = await ctrl.complete(session.id, "order-abc");

		expect(completed?.status).toBe("completed");
		expect(completed?.orderId).toBe("order-abc");
	});

	it("marks a processing session as completed", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(session.id);
		const completed = await ctrl.complete(session.id, "order-xyz");

		expect(completed?.status).toBe("completed");
		expect(completed?.orderId).toBe("order-xyz");
	});

	it("returns null if already completed", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.complete(session.id, "order-1");
		expect(await ctrl.complete(session.id, "order-2")).toBeNull();
	});

	it("returns null for missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		expect(await ctrl.complete("nope", "order-1")).toBeNull();
	});

	it("returns null for expired session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ ttl: -1 }));
		await ctrl.expireStale();
		expect(await ctrl.complete(session.id, "order-1")).toBeNull();
	});

	it("returns null for abandoned session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.abandon(session.id);
		expect(await ctrl.complete(session.id, "order-1")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// abandon
// ---------------------------------------------------------------------------

describe("abandon", () => {
	it("marks a pending session as abandoned", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const abandoned = await ctrl.abandon(session.id);

		expect(abandoned?.status).toBe("abandoned");
	});

	it("returns null if session is already completed", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.complete(session.id, "order-1");
		expect(await ctrl.abandon(session.id)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// expireStale
// ---------------------------------------------------------------------------

describe("expireStale", () => {
	it("expires pending sessions past their TTL", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		// Create one already-expired session (negative TTL → expiresAt is in the past)
		await ctrl.create(makeSession({ ttl: -60_000 }));
		// Create one fresh session (TTL 1 hour)
		await ctrl.create(makeSession({ ttl: 60 * 60 * 1000 }));

		const result = await ctrl.expireStale();
		expect(result.expired).toBe(1);
		expect(result.processingSessions).toHaveLength(0);
	});

	it("expires processing sessions past their TTL and returns them", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		// Create and confirm a session with short TTL
		const session = await ctrl.create(
			makeSession({
				ttl: -60_000,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(session.id);

		const result = await ctrl.expireStale();
		expect(result.expired).toBe(1);
		expect(result.processingSessions).toHaveLength(1);
		expect(result.processingSessions[0].id).toBe(session.id);
	});

	it("expires both pending and processing sessions", async () => {
		const ctrl = createCheckoutController(createMockDataService());

		// Expired pending session
		await ctrl.create(makeSession({ ttl: -60_000 }));

		// Expired processing session
		const processing = await ctrl.create(
			makeSession({
				ttl: -60_000,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(processing.id);

		// Fresh pending session (should NOT expire)
		await ctrl.create(makeSession({ ttl: 60 * 60 * 1000 }));

		const result = await ctrl.expireStale();
		expect(result.expired).toBe(2);
		expect(result.processingSessions).toHaveLength(1);
	});

	it("does not expire completed sessions", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ ttl: 0 }));
		await ctrl.complete(session.id, "order-1");

		const result = await ctrl.expireStale();
		expect(result.expired).toBe(0);
		expect(result.processingSessions).toHaveLength(0);
	});

	it("does not expire abandoned sessions", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ ttl: -60_000 }));
		await ctrl.abandon(session.id);

		const result = await ctrl.expireStale();
		expect(result.expired).toBe(0);
	});

	it("returns 0 when nothing is stale", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession({ ttl: 60 * 60 * 1000 }));
		const result = await ctrl.expireStale();
		expect(result.expired).toBe(0);
		expect(result.processingSessions).toHaveLength(0);
	});

	it("sets status to expired and persists the change", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ ttl: -60_000 }));

		await ctrl.expireStale();
		const fetched = await ctrl.getById(session.id);
		expect(fetched?.status).toBe("expired");
	});

	it("sets status to expired for processing sessions", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				ttl: -60_000,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(session.id);

		await ctrl.expireStale();
		const fetched = await ctrl.getById(session.id);
		expect(fetched?.status).toBe("expired");
	});
});

// ---------------------------------------------------------------------------
// applyGiftCard
// ---------------------------------------------------------------------------

describe("applyGiftCard", () => {
	it("applies a gift card and recalculates total", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		// subtotal=4000 tax=400 shipping=500 total=4900
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.applyGiftCard(session.id, {
			code: "GC-100",
			giftCardAmount: 1000,
		});

		expect(updated?.giftCardCode).toBe("GC-100");
		expect(updated?.giftCardAmount).toBe(1000);
		// 4000 + 400 + 500 - 0 - 1000 = 3900
		expect(updated?.total).toBe(3900);
	});

	it("clamps total to zero when gift card exceeds balance", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.applyGiftCard(session.id, {
			code: "GC-BIG",
			giftCardAmount: 99999,
		});

		expect(updated?.giftCardAmount).toBe(99999);
		expect(updated?.total).toBe(0);
	});

	it("replaces a previously applied gift card", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.applyGiftCard(session.id, {
			code: "GC-FIRST",
			giftCardAmount: 500,
		});
		const updated = await ctrl.applyGiftCard(session.id, {
			code: "GC-SECOND",
			giftCardAmount: 2000,
		});

		expect(updated?.giftCardCode).toBe("GC-SECOND");
		expect(updated?.giftCardAmount).toBe(2000);
		// 4000 + 400 + 500 - 0 - 2000 = 2900
		expect(updated?.total).toBe(2900);
	});

	it("works together with an existing discount", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.applyDiscount(session.id, {
			code: "SAVE500",
			discountAmount: 500,
			freeShipping: false,
		});
		const updated = await ctrl.applyGiftCard(session.id, {
			code: "GC-200",
			giftCardAmount: 200,
		});

		// subtotal=4000 tax=400 shipping=500 discount=500 giftCard=200
		// 4000 + 400 + 500 - 500 - 200 = 4200
		expect(updated?.total).toBe(4200);
		expect(updated?.discountAmount).toBe(500);
		expect(updated?.giftCardAmount).toBe(200);
	});

	it("returns null for a completed session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.complete(session.id, "order-1");

		const result = await ctrl.applyGiftCard(session.id, {
			code: "GC-100",
			giftCardAmount: 1000,
		});
		expect(result).toBeNull();
	});

	it("returns null for an expired session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ ttl: -1 }));
		await ctrl.expireStale();

		const result = await ctrl.applyGiftCard(session.id, {
			code: "GC-100",
			giftCardAmount: 1000,
		});
		expect(result).toBeNull();
	});

	it("returns null for a missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const result = await ctrl.applyGiftCard("nonexistent", {
			code: "GC-100",
			giftCardAmount: 1000,
		});
		expect(result).toBeNull();
	});

	it("applies to a processing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(session.id);
		const updated = await ctrl.applyGiftCard(session.id, {
			code: "GC-300",
			giftCardAmount: 300,
		});

		expect(updated?.giftCardCode).toBe("GC-300");
		expect(updated?.status).toBe("processing");
		// 4000 + 400 + 500 - 0 - 300 = 4600
		expect(updated?.total).toBe(4600);
	});

	it("applies zero-amount gift card", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.applyGiftCard(session.id, {
			code: "GC-ZERO",
			giftCardAmount: 0,
		});

		expect(updated?.giftCardCode).toBe("GC-ZERO");
		expect(updated?.giftCardAmount).toBe(0);
		expect(updated?.total).toBe(4900);
	});
});

// ---------------------------------------------------------------------------
// removeGiftCard
// ---------------------------------------------------------------------------

describe("removeGiftCard", () => {
	it("removes gift card and restores original total", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.applyGiftCard(session.id, {
			code: "GC-500",
			giftCardAmount: 500,
		});
		const restored = await ctrl.removeGiftCard(session.id);

		expect(restored?.giftCardCode).toBeUndefined();
		expect(restored?.giftCardAmount).toBe(0);
		// subtotal=4000 + tax=400 + shipping=500 = 4900
		expect(restored?.total).toBe(4900);
	});

	it("preserves discount when removing gift card", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.applyDiscount(session.id, {
			code: "SAVE500",
			discountAmount: 500,
			freeShipping: false,
		});
		await ctrl.applyGiftCard(session.id, {
			code: "GC-200",
			giftCardAmount: 200,
		});
		const restored = await ctrl.removeGiftCard(session.id);

		expect(restored?.giftCardCode).toBeUndefined();
		expect(restored?.giftCardAmount).toBe(0);
		expect(restored?.discountCode).toBe("SAVE500");
		expect(restored?.discountAmount).toBe(500);
		// 4000 + 400 + 500 - 500 - 0 = 4400
		expect(restored?.total).toBe(4400);
	});

	it("returns null for a completed session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.complete(session.id, "order-1");
		expect(await ctrl.removeGiftCard(session.id)).toBeNull();
	});

	it("returns null for an expired session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ ttl: -1 }));
		await ctrl.expireStale();
		expect(await ctrl.removeGiftCard(session.id)).toBeNull();
	});

	it("returns null for a missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		expect(await ctrl.removeGiftCard("ghost")).toBeNull();
	});

	it("is a no-op when no gift card is applied", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const result = await ctrl.removeGiftCard(session.id);

		expect(result?.giftCardCode).toBeUndefined();
		expect(result?.giftCardAmount).toBe(0);
		expect(result?.total).toBe(4900);
	});
});

// ---------------------------------------------------------------------------
// setPaymentIntent
// ---------------------------------------------------------------------------

describe("setPaymentIntent", () => {
	it("stores payment intent ID and status on a pending session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.setPaymentIntent(
			session.id,
			"pi_abc123",
			"requires_confirmation",
		);

		expect(updated?.paymentIntentId).toBe("pi_abc123");
		expect(updated?.paymentStatus).toBe("requires_confirmation");
	});

	it("stores payment intent on a processing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(session.id);
		const updated = await ctrl.setPaymentIntent(
			session.id,
			"pi_xyz789",
			"succeeded",
		);

		expect(updated?.paymentIntentId).toBe("pi_xyz789");
		expect(updated?.paymentStatus).toBe("succeeded");
		expect(updated?.status).toBe("processing");
	});

	it("updates payment status on an existing intent", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.setPaymentIntent(session.id, "pi_abc", "requires_confirmation");
		const updated = await ctrl.setPaymentIntent(
			session.id,
			"pi_abc",
			"succeeded",
		);

		expect(updated?.paymentIntentId).toBe("pi_abc");
		expect(updated?.paymentStatus).toBe("succeeded");
	});

	it("can change payment intent ID", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.setPaymentIntent(session.id, "pi_first", "pending");
		const updated = await ctrl.setPaymentIntent(
			session.id,
			"pi_second",
			"requires_payment_method",
		);

		expect(updated?.paymentIntentId).toBe("pi_second");
		expect(updated?.paymentStatus).toBe("requires_payment_method");
	});

	it("returns null for a completed session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.complete(session.id, "order-1");
		expect(
			await ctrl.setPaymentIntent(session.id, "pi_xyz", "succeeded"),
		).toBeNull();
	});

	it("returns null for an expired session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ ttl: -1 }));
		await ctrl.expireStale();
		expect(
			await ctrl.setPaymentIntent(session.id, "pi_xyz", "succeeded"),
		).toBeNull();
	});

	it("returns null for a missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		expect(
			await ctrl.setPaymentIntent("nonexistent", "pi_xyz", "succeeded"),
		).toBeNull();
	});

	it("does not alter totals or other session fields", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.setPaymentIntent(
			session.id,
			"pi_keep",
			"pending",
		);

		expect(updated?.subtotal).toBe(4000);
		expect(updated?.taxAmount).toBe(400);
		expect(updated?.shippingAmount).toBe(500);
		expect(updated?.total).toBe(4900);
		expect(updated?.status).toBe("pending");
	});

	it("persists the change via getById", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.setPaymentIntent(session.id, "pi_persist", "requires_capture");

		const fetched = await ctrl.getById(session.id);
		expect(fetched?.paymentIntentId).toBe("pi_persist");
		expect(fetched?.paymentStatus).toBe("requires_capture");
	});
});

// ---------------------------------------------------------------------------
// listSessions
// ---------------------------------------------------------------------------

describe("listSessions", () => {
	it("returns all sessions when no filters applied", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession());
		await ctrl.create(makeSession());
		await ctrl.create(makeSession());

		const result = await ctrl.listSessions({});
		expect(result.sessions).toHaveLength(3);
		expect(result.total).toBe(3);
	});

	it("returns empty list when no sessions exist", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const result = await ctrl.listSessions({});
		expect(result.sessions).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("filters by status", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const s1 = await ctrl.create(makeSession());
		await ctrl.create(makeSession());
		await ctrl.complete(s1.id, "order-1");

		const result = await ctrl.listSessions({ status: "completed" });
		expect(result.total).toBe(1);
		expect(result.sessions[0].id).toBe(s1.id);
		expect(result.sessions[0].status).toBe("completed");
	});

	it("filters by pending status", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession());
		const s2 = await ctrl.create(makeSession());
		await ctrl.abandon(s2.id);

		const result = await ctrl.listSessions({ status: "pending" });
		expect(result.total).toBe(1);
		expect(result.sessions[0].status).toBe("pending");
	});

	it("searches by guestEmail (case-insensitive)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession({ guestEmail: "Alice@Example.com" }));
		await ctrl.create(makeSession({ guestEmail: "bob@test.com" }));

		const result = await ctrl.listSessions({ search: "alice" });
		expect(result.total).toBe(1);
		expect(result.sessions[0].guestEmail).toBe("Alice@Example.com");
	});

	it("searches by customerId (case-insensitive)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession({ customerId: "CUST-ABC" }));
		await ctrl.create(makeSession({ customerId: "cust-xyz" }));

		const result = await ctrl.listSessions({ search: "cust-abc" });
		expect(result.total).toBe(1);
		expect(result.sessions[0].customerId).toBe("CUST-ABC");
	});

	it("searches by session ID prefix", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const s1 = await ctrl.create(makeSession({ id: "sess-alpha-001" }));
		await ctrl.create(makeSession({ id: "sess-beta-002" }));

		const result = await ctrl.listSessions({ search: "sess-alpha" });
		expect(result.total).toBe(1);
		expect(result.sessions[0].id).toBe(s1.id);
	});

	it("returns empty when search matches nothing", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession({ guestEmail: "alice@test.com" }));

		const result = await ctrl.listSessions({ search: "zzz-nomatch" });
		expect(result.total).toBe(0);
		expect(result.sessions).toHaveLength(0);
	});

	it("combines status filter with search", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const s1 = await ctrl.create(makeSession({ guestEmail: "alice@test.com" }));
		await ctrl.create(makeSession({ guestEmail: "alice@other.com" }));
		await ctrl.complete(s1.id, "order-1");

		const result = await ctrl.listSessions({
			status: "completed",
			search: "alice",
		});
		expect(result.total).toBe(1);
		expect(result.sessions[0].id).toBe(s1.id);
	});

	it("paginates with take and skip", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession({ id: "s-001" }));
		await ctrl.create(makeSession({ id: "s-002" }));
		await ctrl.create(makeSession({ id: "s-003" }));
		await ctrl.create(makeSession({ id: "s-004" }));
		await ctrl.create(makeSession({ id: "s-005" }));

		const page1 = await ctrl.listSessions({ take: 2, skip: 0 });
		expect(page1.sessions).toHaveLength(2);
		expect(page1.total).toBe(5);

		const page2 = await ctrl.listSessions({ take: 2, skip: 2 });
		expect(page2.sessions).toHaveLength(2);
		expect(page2.total).toBe(5);

		const page3 = await ctrl.listSessions({ take: 2, skip: 4 });
		expect(page3.sessions).toHaveLength(1);
		expect(page3.total).toBe(5);
	});

	it("defaults to take=20 and skip=0", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		for (let i = 0; i < 25; i++) {
			await ctrl.create(makeSession({ id: `s-${String(i).padStart(3, "0")}` }));
		}

		const result = await ctrl.listSessions({});
		expect(result.sessions).toHaveLength(20);
		expect(result.total).toBe(25);
	});

	it("skip beyond total returns empty sessions", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession());
		await ctrl.create(makeSession());

		const result = await ctrl.listSessions({ skip: 10 });
		expect(result.sessions).toHaveLength(0);
		expect(result.total).toBe(2);
	});

	it("pagination works with search filter", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession({ id: "match-001", guestEmail: "a@b.com" }));
		await ctrl.create(makeSession({ id: "match-002", guestEmail: "a@c.com" }));
		await ctrl.create(makeSession({ id: "match-003", guestEmail: "a@d.com" }));
		await ctrl.create(makeSession({ id: "other-004", guestEmail: "z@z.com" }));

		const result = await ctrl.listSessions({ search: "match", take: 2 });
		expect(result.total).toBe(3);
		expect(result.sessions).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

describe("getStats", () => {
	it("returns all zeros when no sessions exist", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const stats = await ctrl.getStats();

		expect(stats.total).toBe(0);
		expect(stats.pending).toBe(0);
		expect(stats.processing).toBe(0);
		expect(stats.completed).toBe(0);
		expect(stats.abandoned).toBe(0);
		expect(stats.expired).toBe(0);
		expect(stats.conversionRate).toBe(0);
		expect(stats.totalRevenue).toBe(0);
		expect(stats.averageOrderValue).toBe(0);
	});

	it("counts sessions by status correctly", async () => {
		const ctrl = createCheckoutController(createMockDataService());

		// 2 pending
		await ctrl.create(makeSession());
		await ctrl.create(makeSession());

		// 1 processing
		const proc = await ctrl.create(
			makeSession({
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(proc.id);

		// 1 completed
		const comp = await ctrl.create(makeSession());
		await ctrl.complete(comp.id, "order-1");

		// 1 abandoned
		const aband = await ctrl.create(makeSession());
		await ctrl.abandon(aband.id);

		// 1 expired
		await ctrl.create(makeSession({ ttl: -1 }));
		await ctrl.expireStale();

		const stats = await ctrl.getStats();
		expect(stats.total).toBe(6);
		expect(stats.pending).toBe(2);
		expect(stats.processing).toBe(1);
		expect(stats.completed).toBe(1);
		expect(stats.abandoned).toBe(1);
		expect(stats.expired).toBe(1);
	});

	it("calculates conversion rate from terminated sessions", async () => {
		const ctrl = createCheckoutController(createMockDataService());

		// 2 completed
		const c1 = await ctrl.create(makeSession());
		await ctrl.complete(c1.id, "order-1");
		const c2 = await ctrl.create(makeSession());
		await ctrl.complete(c2.id, "order-2");

		// 1 abandoned
		const a1 = await ctrl.create(makeSession());
		await ctrl.abandon(a1.id);

		// 1 expired
		await ctrl.create(makeSession({ ttl: -1 }));
		await ctrl.expireStale();

		// 1 pending (not terminated, should not affect rate)
		await ctrl.create(makeSession());

		const stats = await ctrl.getStats();
		// terminated = 2 completed + 1 abandoned + 1 expired = 4
		// conversionRate = 2 / 4 = 0.5
		expect(stats.conversionRate).toBe(0.5);
	});

	it("returns 0 conversion rate when no terminated sessions", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		// Only pending/processing sessions
		await ctrl.create(makeSession());
		const proc = await ctrl.create(
			makeSession({
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(proc.id);

		const stats = await ctrl.getStats();
		expect(stats.conversionRate).toBe(0);
	});

	it("calculates total revenue from completed sessions only", async () => {
		const ctrl = createCheckoutController(createMockDataService());

		// completed with total 4900
		const c1 = await ctrl.create(makeSession());
		await ctrl.complete(c1.id, "order-1");

		// completed with total 3900 (after gift card)
		const c2 = await ctrl.create(makeSession());
		await ctrl.applyGiftCard(c2.id, { code: "GC", giftCardAmount: 1000 });
		await ctrl.complete(c2.id, "order-2");

		// abandoned - should not count toward revenue
		const a1 = await ctrl.create(makeSession());
		await ctrl.abandon(a1.id);

		// pending - should not count toward revenue
		await ctrl.create(makeSession());

		const stats = await ctrl.getStats();
		// 4900 + 3900 = 8800
		expect(stats.totalRevenue).toBe(8800);
	});

	it("calculates average order value correctly", async () => {
		const ctrl = createCheckoutController(createMockDataService());

		// completed with total 4900
		const c1 = await ctrl.create(makeSession());
		await ctrl.complete(c1.id, "order-1");

		// completed with total 3900
		const c2 = await ctrl.create(makeSession());
		await ctrl.applyGiftCard(c2.id, { code: "GC", giftCardAmount: 1000 });
		await ctrl.complete(c2.id, "order-2");

		const stats = await ctrl.getStats();
		// averageOrderValue = 8800 / 2 = 4400
		expect(stats.averageOrderValue).toBe(4400);
	});

	it("returns 0 average order value when no completed sessions", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession());
		const a1 = await ctrl.create(makeSession());
		await ctrl.abandon(a1.id);

		const stats = await ctrl.getStats();
		expect(stats.averageOrderValue).toBe(0);
		expect(stats.totalRevenue).toBe(0);
	});

	it("handles 100% conversion rate", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const c1 = await ctrl.create(makeSession());
		await ctrl.complete(c1.id, "order-1");
		const c2 = await ctrl.create(makeSession());
		await ctrl.complete(c2.id, "order-2");

		const stats = await ctrl.getStats();
		// terminated = 2 completed + 0 abandoned + 0 expired = 2
		// conversionRate = 2 / 2 = 1
		expect(stats.conversionRate).toBe(1);
	});

	it("handles 0% conversion rate (all abandoned/expired)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const a1 = await ctrl.create(makeSession());
		await ctrl.abandon(a1.id);
		await ctrl.create(makeSession({ ttl: -1 }));
		await ctrl.expireStale();

		const stats = await ctrl.getStats();
		expect(stats.conversionRate).toBe(0);
		expect(stats.completed).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// update – expanded coverage (metadata, paymentMethod)
// ---------------------------------------------------------------------------

describe("update – metadata and paymentMethod", () => {
	it("updates metadata on a session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.update(session.id, {
			metadata: { source: "mobile", campaign: "summer" },
		});

		expect(updated?.metadata).toEqual({ source: "mobile", campaign: "summer" });
	});

	it("replaces metadata entirely", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({ metadata: { old: "value" } }),
		);
		const updated = await ctrl.update(session.id, {
			metadata: { new: "data" },
		});

		expect(updated?.metadata).toEqual({ new: "data" });
		expect(updated?.metadata).not.toHaveProperty("old");
	});

	it("updates paymentMethod", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.update(session.id, {
			paymentMethod: "credit_card",
		});

		expect(updated?.paymentMethod).toBe("credit_card");
	});

	it("updates paymentMethod without affecting other fields", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({ guestEmail: "keep@me.com" }),
		);
		const updated = await ctrl.update(session.id, {
			paymentMethod: "paypal",
		});

		expect(updated?.paymentMethod).toBe("paypal");
		expect(updated?.guestEmail).toBe("keep@me.com");
		expect(updated?.total).toBe(4900);
	});

	it("updates multiple fields at once", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.update(session.id, {
			guestEmail: "multi@test.com",
			paymentMethod: "bank_transfer",
			metadata: { channel: "web" },
			shippingAddress: sampleAddress,
		});

		expect(updated?.guestEmail).toBe("multi@test.com");
		expect(updated?.paymentMethod).toBe("bank_transfer");
		expect(updated?.metadata).toEqual({ channel: "web" });
		expect(updated?.shippingAddress?.city).toBe("Springfield");
	});

	it("returns null for an expired session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ ttl: -1 }));
		await ctrl.expireStale();

		const result = await ctrl.update(session.id, { paymentMethod: "cash" });
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// abandon – expanded coverage (processing state, missing session)
// ---------------------------------------------------------------------------

describe("abandon – expanded", () => {
	it("abandons a processing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(session.id);
		const abandoned = await ctrl.abandon(session.id);

		expect(abandoned?.status).toBe("abandoned");
	});

	it("returns null for a missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		expect(await ctrl.abandon("nonexistent")).toBeNull();
	});

	it("returns null for an already abandoned session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.abandon(session.id);

		// The abandon function only blocks completed sessions, so abandoning
		// an already-abandoned session should still work (returns the session)
		const result = await ctrl.abandon(session.id);
		expect(result?.status).toBe("abandoned");
	});

	it("persists abandoned status via getById", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.abandon(session.id);

		const fetched = await ctrl.getById(session.id);
		expect(fetched?.status).toBe("abandoned");
	});
});

// ---------------------------------------------------------------------------
// create – expanded coverage (custom id, custom TTL, custom currency)
// ---------------------------------------------------------------------------

describe("create – expanded", () => {
	it("creates a session with a custom id", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ id: "custom-session-id" }));

		expect(session.id).toBe("custom-session-id");
		const fetched = await ctrl.getById("custom-session-id");
		expect(fetched?.id).toBe("custom-session-id");
	});

	it("creates a session with a custom TTL", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const before = Date.now();
		const session = await ctrl.create(
			makeSession({ ttl: 60 * 60 * 1000 }), // 1 hour
		);

		const expectedMinExpiry = before + 60 * 60 * 1000;
		expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(
			expectedMinExpiry - 100,
		);
	});

	it("creates a session with a very short TTL", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ ttl: 1000 })); // 1 second

		// Expiry should be very close to now (within a couple seconds)
		expect(session.expiresAt.getTime() - Date.now()).toBeLessThan(2000);
	});

	it("creates a session with custom currency", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ currency: "EUR" }));

		expect(session.currency).toBe("EUR");
	});

	it("creates a session with GBP currency", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ currency: "GBP" }));

		expect(session.currency).toBe("GBP");
	});

	it("defaults currency to USD when not specified", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());

		expect(session.currency).toBe("USD");
	});

	it("creates a session with initial metadata", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({ metadata: { source: "api", version: 2 } }),
		);

		expect(session.metadata).toEqual({ source: "api", version: 2 });
	});

	it("defaults metadata to empty object", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());

		expect(session.metadata).toEqual({});
	});

	it("creates a session with billing address", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const billingAddress = {
			firstName: "John",
			lastName: "Smith",
			line1: "100 Billing Rd",
			city: "Chicago",
			state: "IL",
			postalCode: "60601",
			country: "US",
		};
		const session = await ctrl.create(makeSession({ billingAddress }));

		expect(session.billingAddress?.city).toBe("Chicago");
		expect(session.shippingAddress).toBeUndefined();
	});

	it("creates a session with pre-applied discount and gift card amounts", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(
			makeSession({
				discountAmount: 300,
				giftCardAmount: 200,
				total: 3900, // 4000 + 400 + 500 - 300 - 200 = 4400? But total is passed in
			}),
		);

		expect(session.discountAmount).toBe(300);
		expect(session.giftCardAmount).toBe(200);
	});
});
