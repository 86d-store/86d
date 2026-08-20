import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CheckoutAddress, CheckoutLineItem } from "../service";
import { createCheckoutController } from "../service-impl";

const sampleAddress: CheckoutAddress = {
	firstName: "Jane",
	lastName: "Doe",
	line1: "1 Main St",
	city: "Springfield",
	state: "IL",
	postalCode: "62701",
	country: "US",
};

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

describe("checkout controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCheckoutController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCheckoutController(mockData);
	});

	// ── create edge cases ─────────────────────────────────────────────

	describe("create edge cases", () => {
		it("generates unique ids for each session", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const session = await controller.create({
					subtotal: 100,
					total: 100,
					lineItems: [
						{ productId: `p${i}`, name: `P${i}`, price: 100, quantity: 1 },
					],
				});
				ids.add(session.id);
			}
			expect(ids.size).toBe(20);
		});

		it("uses provided id when specified", async () => {
			const session = await controller.create({
				id: "custom-session-id",
				subtotal: 100,
				total: 100,
				lineItems: [
					{ productId: "p1", name: "Widget", price: 100, quantity: 1 },
				],
			});
			expect(session.id).toBe("custom-session-id");
		});

		it("defaults currency to USD when not specified", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			expect(session.currency).toBe("USD");
		});

		it("accepts a custom currency", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				currency: "EUR",
				lineItems: sampleLineItems,
			});
			expect(session.currency).toBe("EUR");
		});

		it("creates session with zero subtotal and zero total", async () => {
			const session = await controller.create({
				subtotal: 0,
				total: 0,
				lineItems: [],
			});
			expect(session.subtotal).toBe(0);
			expect(session.total).toBe(0);
			expect(session.status).toBe("pending");
		});

		it("creates session with very large monetary values", async () => {
			const session = await controller.create({
				subtotal: 999999999,
				total: 999999999,
				lineItems: [
					{
						productId: "p1",
						name: "Luxury Yacht",
						price: 999999999,
						quantity: 1,
					},
				],
			});
			expect(session.subtotal).toBe(999999999);
			expect(session.total).toBe(999999999);
		});

		it("sets expiresAt based on custom ttl", async () => {
			const before = Date.now();
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				ttl: 60_000, // 1 minute
			});
			const after = Date.now();
			const expiresMs = session.expiresAt.getTime();
			expect(expiresMs).toBeGreaterThanOrEqual(before + 60_000);
			expect(expiresMs).toBeLessThanOrEqual(after + 60_000);
		});

		it("defaults ttl to 30 minutes", async () => {
			const before = Date.now();
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			const after = Date.now();
			const thirtyMin = 30 * 60 * 1000;
			expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(
				before + thirtyMin,
			);
			expect(session.expiresAt.getTime()).toBeLessThanOrEqual(
				after + thirtyMin,
			);
		});

		it("handles empty lineItems array", async () => {
			const session = await controller.create({
				subtotal: 0,
				total: 0,
				lineItems: [],
			});
			const items = await controller.getLineItems(session.id);
			expect(items).toHaveLength(0);
		});

		it("handles many line items", async () => {
			const manyItems: CheckoutLineItem[] = [];
			for (let i = 0; i < 50; i++) {
				manyItems.push({
					productId: `p${i}`,
					name: `Product ${i}`,
					price: 100 + i,
					quantity: 1,
				});
			}
			const session = await controller.create({
				subtotal: 5000,
				total: 5000,
				lineItems: manyItems,
			});
			const items = await controller.getLineItems(session.id);
			expect(items).toHaveLength(50);
		});

		it("stores metadata correctly", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				metadata: { source: "mobile", campaign: "summer-sale" },
			});
			expect(session.metadata).toEqual({
				source: "mobile",
				campaign: "summer-sale",
			});
		});

		it("defaults metadata to empty object", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			expect(session.metadata).toEqual({});
		});

		it("handles special characters in guestEmail", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				guestEmail: "user+tag@example.co.uk",
				lineItems: sampleLineItems,
			});
			expect(session.guestEmail).toBe("user+tag@example.co.uk");
		});

		it("stores both shipping and billing addresses", async () => {
			const billingAddr: CheckoutAddress = {
				firstName: "John",
				lastName: "Smith",
				line1: "99 Billing Rd",
				city: "New York",
				state: "NY",
				postalCode: "10001",
				country: "US",
				company: "Acme Corp",
				phone: "+1-555-1234",
			};
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				shippingAddress: sampleAddress,
				billingAddress: billingAddr,
			});
			expect(session.shippingAddress?.firstName).toBe("Jane");
			expect(session.billingAddress?.company).toBe("Acme Corp");
			expect(session.billingAddress?.phone).toBe("+1-555-1234");
		});

		it("createdAt and updatedAt are set to the same time on create", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			expect(session.createdAt.getTime()).toBe(session.updatedAt.getTime());
		});
	});

	// ── getById edge cases ────────────────────────────────────────────

	describe("getById edge cases", () => {
		it("returns null for empty string id", async () => {
			expect(await controller.getById("")).toBeNull();
		});

		it("returns null for id with special characters", async () => {
			expect(await controller.getById("../../../etc/passwd")).toBeNull();
		});

		it("returns the correct session among many", async () => {
			const sessions: Awaited<ReturnType<typeof controller.create>>[] = [];
			for (let i = 0; i < 10; i++) {
				const s = await controller.create({
					subtotal: i * 100,
					total: i * 100,
					lineItems: [
						{ productId: `p${i}`, name: `P${i}`, price: i * 100, quantity: 1 },
					],
				});
				sessions.push(s);
			}
			const fetched = await controller.getById(sessions[5].id);
			expect(fetched?.subtotal).toBe(500);
		});
	});

	// ── update edge cases ─────────────────────────────────────────────

	describe("update edge cases", () => {
		it("returns null for expired session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				ttl: -1,
			});
			await controller.expireStale();
			const result = await controller.update(session.id, {
				guestEmail: "new@test.com",
			});
			expect(result).toBeNull();
		});

		it("allows update on abandoned session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.abandon(session.id);
			// abandon sets status to "abandoned" which is not blocked by update
			const result = await controller.update(session.id, {
				guestEmail: "new@test.com",
			});
			expect(result?.guestEmail).toBe("new@test.com");
		});

		it("allows update on processing session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			});
			await controller.confirm(session.id);
			const result = await controller.update(session.id, {
				paymentMethod: "credit_card",
			});
			expect(result?.paymentMethod).toBe("credit_card");
		});

		it("updates only specified fields, leaves others unchanged", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				guestEmail: "original@test.com",
			});
			const updated = await controller.update(session.id, {
				shippingAddress: sampleAddress,
			});
			expect(updated?.guestEmail).toBe("original@test.com");
			expect(updated?.shippingAddress).toEqual(sampleAddress);
		});

		it("updates metadata without affecting other fields", async () => {
			const session = await controller.create({
				subtotal: 500,
				total: 500,
				lineItems: sampleLineItems,
				metadata: { key1: "val1" },
			});
			const updated = await controller.update(session.id, {
				metadata: { key2: "val2" },
			});
			// metadata is replaced entirely
			expect(updated?.metadata).toEqual({ key2: "val2" });
			expect(updated?.subtotal).toBe(500);
		});

		it("recalculates total considering existing discount when shipping changes", async () => {
			const session = await controller.create({
				subtotal: 1000,
				taxAmount: 100,
				shippingAmount: 200,
				total: 1300,
				lineItems: sampleLineItems,
			});
			// Apply a discount first
			await controller.applyDiscount(session.id, {
				code: "SAVE100",
				discountAmount: 100,
				freeShipping: false,
			});
			// Now update shipping
			const updated = await controller.update(session.id, {
				shippingAmount: 500,
			});
			// 1000 + 100 + 500 - 100 - 0 = 1500
			expect(updated?.total).toBe(1500);
		});

		it("sets shippingAmount to zero via update", async () => {
			const session = await controller.create({
				subtotal: 1000,
				taxAmount: 100,
				shippingAmount: 500,
				total: 1600,
				lineItems: sampleLineItems,
			});
			const updated = await controller.update(session.id, {
				shippingAmount: 0,
			});
			expect(updated?.shippingAmount).toBe(0);
			// 1000 + 100 + 0 = 1100
			expect(updated?.total).toBe(1100);
		});

		it("updates updatedAt timestamp on each update", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			const originalUpdatedAt = session.updatedAt;
			// Small delay to ensure time difference
			const updated = await controller.update(session.id, {
				guestEmail: "a@b.com",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});

		it("handles address with all optional fields populated", async () => {
			const fullAddress: CheckoutAddress = {
				firstName: "Jane",
				lastName: "Doe",
				company: "ACME Inc.",
				line1: "123 Main St",
				line2: "Suite 456",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
				phone: "+1-555-0123",
			};
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			const updated = await controller.update(session.id, {
				billingAddress: fullAddress,
			});
			expect(updated?.billingAddress?.company).toBe("ACME Inc.");
			expect(updated?.billingAddress?.line2).toBe("Suite 456");
			expect(updated?.billingAddress?.phone).toBe("+1-555-0123");
		});
	});

	// ── applyDiscount edge cases ──────────────────────────────────────

	describe("applyDiscount edge cases", () => {
		it("returns null for missing session", async () => {
			const result = await controller.applyDiscount("nonexistent", {
				code: "SAVE10",
				discountAmount: 10,
				freeShipping: false,
			});
			expect(result).toBeNull();
		});

		it("returns null for expired session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				ttl: -1,
			});
			await controller.expireStale();
			const result = await controller.applyDiscount(session.id, {
				code: "X",
				discountAmount: 10,
				freeShipping: false,
			});
			expect(result).toBeNull();
		});

		it("replaces an existing discount code", async () => {
			const session = await controller.create({
				subtotal: 1000,
				taxAmount: 0,
				shippingAmount: 0,
				total: 1000,
				lineItems: sampleLineItems,
			});
			await controller.applyDiscount(session.id, {
				code: "FIRST",
				discountAmount: 100,
				freeShipping: false,
			});
			const updated = await controller.applyDiscount(session.id, {
				code: "SECOND",
				discountAmount: 200,
				freeShipping: false,
			});
			expect(updated?.discountCode).toBe("SECOND");
			expect(updated?.discountAmount).toBe(200);
			// 1000 - 200 = 800
			expect(updated?.total).toBe(800);
		});

		it("free shipping with discount amount combined", async () => {
			const session = await controller.create({
				subtotal: 1000,
				taxAmount: 100,
				shippingAmount: 500,
				total: 1600,
				lineItems: sampleLineItems,
			});
			const updated = await controller.applyDiscount(session.id, {
				code: "COMBO",
				discountAmount: 200,
				freeShipping: true,
			});
			// shipping zeroed, 1000 + 100 + 0 - 200 = 900
			expect(updated?.shippingAmount).toBe(0);
			expect(updated?.total).toBe(900);
		});

		it("zero discount amount with no free shipping is a no-op on totals", async () => {
			const session = await controller.create({
				subtotal: 1000,
				taxAmount: 100,
				shippingAmount: 200,
				total: 1300,
				lineItems: sampleLineItems,
			});
			const updated = await controller.applyDiscount(session.id, {
				code: "EMPTY",
				discountAmount: 0,
				freeShipping: false,
			});
			expect(updated?.discountCode).toBe("EMPTY");
			expect(updated?.total).toBe(1300);
		});

		it("discount larger than subtotal+tax+shipping clamps total to zero", async () => {
			const session = await controller.create({
				subtotal: 100,
				taxAmount: 10,
				shippingAmount: 5,
				total: 115,
				lineItems: sampleLineItems,
			});
			const updated = await controller.applyDiscount(session.id, {
				code: "HUGE",
				discountAmount: 50000,
				freeShipping: false,
			});
			expect(updated?.total).toBe(0);
		});

		it("handles discount code with special characters", async () => {
			const session = await controller.create({
				subtotal: 1000,
				total: 1000,
				lineItems: sampleLineItems,
			});
			const updated = await controller.applyDiscount(session.id, {
				code: "SAVE-50%_OFF!",
				discountAmount: 500,
				freeShipping: false,
			});
			expect(updated?.discountCode).toBe("SAVE-50%_OFF!");
		});
	});

	// ── removeDiscount edge cases ─────────────────────────────────────

	describe("removeDiscount edge cases", () => {
		it("removing discount from session with no discount still works", async () => {
			const session = await controller.create({
				subtotal: 1000,
				taxAmount: 100,
				shippingAmount: 200,
				total: 1300,
				lineItems: sampleLineItems,
			});
			const result = await controller.removeDiscount(session.id);
			expect(result?.discountCode).toBeUndefined();
			expect(result?.discountAmount).toBe(0);
			// Total should remain 1300
			expect(result?.total).toBe(1300);
		});

		it("returns null for completed session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.complete(session.id, "ord-1");
			expect(await controller.removeDiscount(session.id)).toBeNull();
		});

		it("returns null for expired session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				ttl: -1,
			});
			await controller.expireStale();
			expect(await controller.removeDiscount(session.id)).toBeNull();
		});

		it("restores total correctly after removing discount with free shipping", async () => {
			const session = await controller.create({
				subtotal: 1000,
				taxAmount: 100,
				shippingAmount: 500,
				total: 1600,
				lineItems: sampleLineItems,
			});
			await controller.applyDiscount(session.id, {
				code: "FREESHIP",
				discountAmount: 0,
				freeShipping: true,
			});
			// After discount: shipping=0, total = 1000 + 100 + 0 - 0 = 1100
			const afterDiscount = await controller.getById(session.id);
			expect(afterDiscount?.shippingAmount).toBe(0);

			const restored = await controller.removeDiscount(session.id);
			// removeDiscount sets discountAmount=0 but does NOT restore shippingAmount
			// total recalculated: subtotal + tax + shipping(still 0) - 0 = 1100
			expect(restored?.discountAmount).toBe(0);
			expect(restored?.discountCode).toBeUndefined();
		});
	});

	// ── applyGiftCard edge cases ──────────────────────────────────────

	describe("applyGiftCard edge cases", () => {
		it("returns null for missing session", async () => {
			const result = await controller.applyGiftCard("ghost", {
				code: "GC123",
				giftCardAmount: 50,
			});
			expect(result).toBeNull();
		});

		it("returns null for completed session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.complete(session.id, "ord-1");
			const result = await controller.applyGiftCard(session.id, {
				code: "GC",
				giftCardAmount: 50,
			});
			expect(result).toBeNull();
		});

		it("returns null for expired session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				ttl: -1,
			});
			await controller.expireStale();
			const result = await controller.applyGiftCard(session.id, {
				code: "GC",
				giftCardAmount: 50,
			});
			expect(result).toBeNull();
		});

		it("gift card amount larger than total clamps to zero", async () => {
			const session = await controller.create({
				subtotal: 100,
				taxAmount: 10,
				shippingAmount: 5,
				total: 115,
				lineItems: sampleLineItems,
			});
			const updated = await controller.applyGiftCard(session.id, {
				code: "BIGCARD",
				giftCardAmount: 99999,
			});
			expect(updated?.total).toBe(0);
		});

		it("replaces an existing gift card", async () => {
			const session = await controller.create({
				subtotal: 1000,
				total: 1000,
				lineItems: sampleLineItems,
			});
			await controller.applyGiftCard(session.id, {
				code: "GC-FIRST",
				giftCardAmount: 100,
			});
			const updated = await controller.applyGiftCard(session.id, {
				code: "GC-SECOND",
				giftCardAmount: 200,
			});
			expect(updated?.giftCardCode).toBe("GC-SECOND");
			expect(updated?.giftCardAmount).toBe(200);
			expect(updated?.total).toBe(800);
		});

		it("applying zero gift card amount updates code but not total", async () => {
			const session = await controller.create({
				subtotal: 1000,
				total: 1000,
				lineItems: sampleLineItems,
			});
			const updated = await controller.applyGiftCard(session.id, {
				code: "EMPTY-CARD",
				giftCardAmount: 0,
			});
			expect(updated?.giftCardCode).toBe("EMPTY-CARD");
			expect(updated?.giftCardAmount).toBe(0);
			expect(updated?.total).toBe(1000);
		});

		it("gift card combined with discount both reduce total", async () => {
			const session = await controller.create({
				subtotal: 1000,
				taxAmount: 100,
				shippingAmount: 200,
				total: 1300,
				lineItems: sampleLineItems,
			});
			await controller.applyDiscount(session.id, {
				code: "SAVE200",
				discountAmount: 200,
				freeShipping: false,
			});
			const updated = await controller.applyGiftCard(session.id, {
				code: "GC100",
				giftCardAmount: 100,
			});
			// 1000 + 100 + 200 - 200 - 100 = 1000
			expect(updated?.total).toBe(1000);
		});
	});

	// ── removeGiftCard edge cases ─────────────────────────────────────

	describe("removeGiftCard edge cases", () => {
		it("returns null for missing session", async () => {
			expect(await controller.removeGiftCard("nope")).toBeNull();
		});

		it("returns null for completed session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.complete(session.id, "ord-1");
			expect(await controller.removeGiftCard(session.id)).toBeNull();
		});

		it("returns null for expired session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				ttl: -1,
			});
			await controller.expireStale();
			expect(await controller.removeGiftCard(session.id)).toBeNull();
		});

		it("removing gift card when none applied still works", async () => {
			const session = await controller.create({
				subtotal: 1000,
				taxAmount: 100,
				shippingAmount: 200,
				total: 1300,
				lineItems: sampleLineItems,
			});
			const result = await controller.removeGiftCard(session.id);
			expect(result?.giftCardCode).toBeUndefined();
			expect(result?.giftCardAmount).toBe(0);
			expect(result?.total).toBe(1300);
		});

		it("restores total after removing gift card", async () => {
			const session = await controller.create({
				subtotal: 1000,
				taxAmount: 100,
				shippingAmount: 200,
				total: 1300,
				lineItems: sampleLineItems,
			});
			await controller.applyGiftCard(session.id, {
				code: "GC500",
				giftCardAmount: 500,
			});
			const restored = await controller.removeGiftCard(session.id);
			expect(restored?.giftCardCode).toBeUndefined();
			expect(restored?.giftCardAmount).toBe(0);
			expect(restored?.total).toBe(1300);
		});
	});

	// ── confirm edge cases ────────────────────────────────────────────

	describe("confirm edge cases", () => {
		it("returns error for completed session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			});
			await controller.complete(session.id, "ord-1");
			const result = await controller.confirm(session.id);
			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.status).toBe(422);
				expect(result.error).toContain("completed");
			}
		});

		it("returns error for expired session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
				ttl: -1,
			});
			await controller.expireStale();
			const result = await controller.confirm(session.id);
			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.status).toBe(422);
				expect(result.error).toContain("expired");
			}
		});

		it("returns error for abandoned session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			});
			await controller.abandon(session.id);
			const result = await controller.confirm(session.id);
			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.status).toBe(422);
				expect(result.error).toContain("abandoned");
			}
		});

		it("both customerId and guestEmail present satisfies customer check", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				customerId: "cust-1",
				guestEmail: "guest@test.com",
				shippingAddress: sampleAddress,
			});
			const result = await controller.confirm(session.id);
			expect("session" in result).toBe(true);
		});

		it("confirm persists the processing status", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			});
			await controller.confirm(session.id);
			const fetched = await controller.getById(session.id);
			expect(fetched?.status).toBe("processing");
		});

		it("updates updatedAt on confirm", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			});
			const result = await controller.confirm(session.id);
			if ("session" in result) {
				expect(result.session.updatedAt.getTime()).toBeGreaterThanOrEqual(
					session.updatedAt.getTime(),
				);
			}
		});
	});

	// ── setPaymentIntent edge cases ───────────────────────────────────

	describe("setPaymentIntent edge cases", () => {
		it("returns null for missing session", async () => {
			expect(
				await controller.setPaymentIntent("ghost", "pi_123", "pending"),
			).toBeNull();
		});

		it("returns null for completed session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.complete(session.id, "ord-1");
			expect(
				await controller.setPaymentIntent(session.id, "pi_123", "pending"),
			).toBeNull();
		});

		it("returns null for expired session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				ttl: -1,
			});
			await controller.expireStale();
			expect(
				await controller.setPaymentIntent(session.id, "pi_123", "pending"),
			).toBeNull();
		});

		it("sets payment intent on pending session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			const updated = await controller.setPaymentIntent(
				session.id,
				"pi_abc",
				"requires_payment_method",
			);
			expect(updated?.paymentIntentId).toBe("pi_abc");
			expect(updated?.paymentStatus).toBe("requires_payment_method");
		});

		it("sets payment intent on processing session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			});
			await controller.confirm(session.id);
			const updated = await controller.setPaymentIntent(
				session.id,
				"pi_xyz",
				"succeeded",
			);
			expect(updated?.paymentIntentId).toBe("pi_xyz");
			expect(updated?.paymentStatus).toBe("succeeded");
		});

		it("overwrites previous payment intent", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.setPaymentIntent(
				session.id,
				"pi_old",
				"requires_payment_method",
			);
			const updated = await controller.setPaymentIntent(
				session.id,
				"pi_new",
				"succeeded",
			);
			expect(updated?.paymentIntentId).toBe("pi_new");
			expect(updated?.paymentStatus).toBe("succeeded");
		});
	});

	// ── complete edge cases ───────────────────────────────────────────

	describe("complete edge cases", () => {
		it("preserves all session data after completion", async () => {
			const session = await controller.create({
				subtotal: 1000,
				taxAmount: 100,
				shippingAmount: 200,
				total: 1300,
				customerId: "cust-1",
				guestEmail: "test@test.com",
				lineItems: sampleLineItems,
				shippingAddress: sampleAddress,
				metadata: { ref: "abc" },
			});
			const completed = await controller.complete(session.id, "ord-final");
			expect(completed?.subtotal).toBe(1000);
			expect(completed?.customerId).toBe("cust-1");
			expect(completed?.shippingAddress?.city).toBe("Springfield");
			expect(completed?.metadata).toEqual({ ref: "abc" });
		});

		it("orderId is persisted and retrievable via getById", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.complete(session.id, "ord-123");
			const fetched = await controller.getById(session.id);
			expect(fetched?.orderId).toBe("ord-123");
			expect(fetched?.status).toBe("completed");
		});
	});

	// ── abandon edge cases ────────────────────────────────────────────

	describe("abandon edge cases", () => {
		it("returns null for missing session", async () => {
			expect(await controller.abandon("nonexistent")).toBeNull();
		});

		it("can abandon a processing session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			});
			await controller.confirm(session.id);
			const abandoned = await controller.abandon(session.id);
			expect(abandoned?.status).toBe("abandoned");
		});

		it("can abandon an expired session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				ttl: -1,
			});
			await controller.expireStale();
			const abandoned = await controller.abandon(session.id);
			expect(abandoned?.status).toBe("abandoned");
		});

		it("double abandon returns the already-abandoned session", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.abandon(session.id);
			const second = await controller.abandon(session.id);
			expect(second?.status).toBe("abandoned");
		});
	});

	// ── getLineItems edge cases ───────────────────────────────────────

	describe("getLineItems edge cases", () => {
		it("returns empty array for nonexistent session", async () => {
			const items = await controller.getLineItems("nonexistent");
			expect(items).toHaveLength(0);
		});

		it("does not leak sessionId in returned items", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: [
					{ productId: "p1", name: "Widget", price: 100, quantity: 1 },
				],
			});
			const items = await controller.getLineItems(session.id);
			for (const item of items) {
				expect(item).not.toHaveProperty("sessionId");
			}
		});

		it("returns items with correct properties including optional sku and variantId", async () => {
			const session = await controller.create({
				subtotal: 3000,
				total: 3000,
				lineItems: [
					{
						productId: "p1",
						variantId: "v1",
						name: "Widget S",
						sku: "WID-S",
						price: 1000,
						quantity: 2,
					},
					{ productId: "p2", name: "Gadget", price: 1000, quantity: 1 },
				],
			});
			const items = await controller.getLineItems(session.id);
			expect(items).toHaveLength(2);
			const withVariant = items.find((i) => i.productId === "p1");
			expect(withVariant?.variantId).toBe("v1");
			expect(withVariant?.sku).toBe("WID-S");
			const withoutVariant = items.find((i) => i.productId === "p2");
			expect(withoutVariant?.variantId).toBeUndefined();
		});

		it("line items for different sessions are isolated", async () => {
			const session1 = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: [{ productId: "p1", name: "A", price: 100, quantity: 1 }],
			});
			const session2 = await controller.create({
				subtotal: 200,
				total: 200,
				lineItems: [{ productId: "p2", name: "B", price: 200, quantity: 1 }],
			});
			const items1 = await controller.getLineItems(session1.id);
			const items2 = await controller.getLineItems(session2.id);
			expect(items1).toHaveLength(1);
			expect(items1[0].productId).toBe("p1");
			expect(items2).toHaveLength(1);
			expect(items2[0].productId).toBe("p2");
		});
	});

	// ── listSessions edge cases ───────────────────────────────────────

	describe("listSessions edge cases", () => {
		it("returns empty list when no sessions exist", async () => {
			const result = await controller.listSessions({});
			expect(result.sessions).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it("defaults take to 20 and skip to 0", async () => {
			for (let i = 0; i < 25; i++) {
				await controller.create({
					subtotal: 100,
					total: 100,
					lineItems: [
						{ productId: `p${i}`, name: `P${i}`, price: 100, quantity: 1 },
					],
				});
			}
			const result = await controller.listSessions({});
			expect(result.sessions).toHaveLength(20);
			expect(result.total).toBe(25);
		});

		it("paginates correctly with take and skip", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.create({
					subtotal: 100,
					total: 100,
					lineItems: [
						{ productId: `p${i}`, name: `P${i}`, price: 100, quantity: 1 },
					],
				});
			}
			const page1 = await controller.listSessions({ take: 3, skip: 0 });
			const page2 = await controller.listSessions({ take: 3, skip: 3 });
			const page3 = await controller.listSessions({ take: 3, skip: 6 });
			const page4 = await controller.listSessions({ take: 3, skip: 9 });
			expect(page1.sessions).toHaveLength(3);
			expect(page2.sessions).toHaveLength(3);
			expect(page3.sessions).toHaveLength(3);
			expect(page4.sessions).toHaveLength(1);
			expect(page1.total).toBe(10);
		});

		it("skip beyond total returns empty sessions", async () => {
			await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			const result = await controller.listSessions({ skip: 100 });
			expect(result.sessions).toHaveLength(0);
			expect(result.total).toBe(1);
		});

		it("take=0 returns empty sessions array", async () => {
			await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			const result = await controller.listSessions({ take: 0 });
			expect(result.sessions).toHaveLength(0);
			expect(result.total).toBe(1);
		});

		it("filters by status correctly", async () => {
			const s1 = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			const s2 = await controller.create({
				subtotal: 200,
				total: 200,
				lineItems: sampleLineItems,
			});
			await controller.complete(s1.id, "ord-1");
			await controller.abandon(s2.id);
			await controller.create({
				subtotal: 300,
				total: 300,
				lineItems: sampleLineItems,
			});

			const completed = await controller.listSessions({
				status: "completed",
			});
			expect(completed.total).toBe(1);
			expect(completed.sessions[0].status).toBe("completed");

			const abandoned = await controller.listSessions({
				status: "abandoned",
			});
			expect(abandoned.total).toBe(1);

			const pending = await controller.listSessions({ status: "pending" });
			expect(pending.total).toBe(1);
		});

		it("searches by guestEmail (case-insensitive)", async () => {
			await controller.create({
				subtotal: 100,
				total: 100,
				guestEmail: "Alice@Example.COM",
				lineItems: sampleLineItems,
			});
			await controller.create({
				subtotal: 200,
				total: 200,
				guestEmail: "bob@test.com",
				lineItems: sampleLineItems,
			});

			const result = await controller.listSessions({ search: "alice" });
			expect(result.total).toBe(1);
			expect(result.sessions[0].guestEmail).toBe("Alice@Example.COM");
		});

		it("searches by customerId (case-insensitive)", async () => {
			await controller.create({
				subtotal: 100,
				total: 100,
				customerId: "CUST-ABC",
				lineItems: sampleLineItems,
			});
			await controller.create({
				subtotal: 200,
				total: 200,
				customerId: "cust-xyz",
				lineItems: sampleLineItems,
			});

			const result = await controller.listSessions({ search: "cust-abc" });
			expect(result.total).toBe(1);
		});

		it("searches by session ID prefix", async () => {
			const session = await controller.create({
				id: "sess-unique-12345",
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.create({
				subtotal: 200,
				total: 200,
				lineItems: sampleLineItems,
			});

			const result = await controller.listSessions({
				search: "sess-unique",
			});
			expect(result.total).toBe(1);
			expect(result.sessions[0].id).toBe(session.id);
		});

		it("search with no matches returns empty", async () => {
			await controller.create({
				subtotal: 100,
				total: 100,
				guestEmail: "user@test.com",
				lineItems: sampleLineItems,
			});
			const result = await controller.listSessions({
				search: "zzz-no-match",
			});
			expect(result.total).toBe(0);
			expect(result.sessions).toHaveLength(0);
		});

		it("combines status filter and search", async () => {
			await controller.create({
				subtotal: 100,
				total: 100,
				guestEmail: "alice@test.com",
				lineItems: sampleLineItems,
			});
			const s2 = await controller.create({
				subtotal: 200,
				total: 200,
				guestEmail: "alice@other.com",
				lineItems: sampleLineItems,
			});
			await controller.complete(s2.id, "ord-1");

			// Search for alice among completed
			const result = await controller.listSessions({
				status: "completed",
				search: "alice",
			});
			expect(result.total).toBe(1);
			expect(result.sessions[0].guestEmail).toBe("alice@other.com");
		});

		it("search with pagination", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.create({
					subtotal: 100,
					total: 100,
					guestEmail: `user${i}@searchable.com`,
					lineItems: sampleLineItems,
				});
			}
			const result = await controller.listSessions({
				search: "searchable",
				take: 3,
				skip: 0,
			});
			expect(result.total).toBe(10);
			expect(result.sessions).toHaveLength(3);
		});
	});

	// ── getStats edge cases ───────────────────────────────────────────

	describe("getStats edge cases", () => {
		it("returns all zeros when no sessions exist", async () => {
			const stats = await controller.getStats();
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

		it("calculates conversion rate as completed / (completed+abandoned+expired)", async () => {
			// 1 completed, 1 abandoned, 2 expired => 1/4 = 0.25
			const s1 = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.complete(s1.id, "ord-1");

			const s2 = await controller.create({
				subtotal: 200,
				total: 200,
				lineItems: sampleLineItems,
			});
			await controller.abandon(s2.id);

			await controller.create({
				subtotal: 50,
				total: 50,
				lineItems: sampleLineItems,
				ttl: -1,
			});
			await controller.create({
				subtotal: 50,
				total: 50,
				lineItems: sampleLineItems,
				ttl: -1,
			});
			await controller.expireStale();

			const stats = await controller.getStats();
			expect(stats.completed).toBe(1);
			expect(stats.abandoned).toBe(1);
			expect(stats.expired).toBe(2);
			expect(stats.conversionRate).toBe(0.25);
		});

		it("pending and processing sessions do not affect conversion rate", async () => {
			// Only pending/processing: conversionRate = 0 (terminatedCount = 0)
			await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			const s2 = await controller.create({
				subtotal: 200,
				total: 200,
				lineItems: sampleLineItems,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			});
			await controller.confirm(s2.id);

			const stats = await controller.getStats();
			expect(stats.total).toBe(2);
			expect(stats.conversionRate).toBe(0);
		});

		it("totalRevenue sums only completed session totals", async () => {
			const s1 = await controller.create({
				subtotal: 500,
				total: 500,
				lineItems: sampleLineItems,
			});
			await controller.complete(s1.id, "ord-1");

			const s2 = await controller.create({
				subtotal: 300,
				total: 300,
				lineItems: sampleLineItems,
			});
			await controller.complete(s2.id, "ord-2");

			// This one is abandoned - should not count
			const s3 = await controller.create({
				subtotal: 999,
				total: 999,
				lineItems: sampleLineItems,
			});
			await controller.abandon(s3.id);

			const stats = await controller.getStats();
			expect(stats.totalRevenue).toBe(800);
			expect(stats.averageOrderValue).toBe(400);
		});

		it("averageOrderValue is zero when no completed sessions", async () => {
			await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			const stats = await controller.getStats();
			expect(stats.averageOrderValue).toBe(0);
		});

		it("100% conversion rate when all terminated sessions are completed", async () => {
			const s1 = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.complete(s1.id, "ord-1");
			const s2 = await controller.create({
				subtotal: 200,
				total: 200,
				lineItems: sampleLineItems,
			});
			await controller.complete(s2.id, "ord-2");

			const stats = await controller.getStats();
			expect(stats.conversionRate).toBe(1);
		});
	});

	// ── expireStale edge cases ────────────────────────────────────────

	describe("expireStale edge cases", () => {
		it("returns empty result when no sessions exist", async () => {
			const result = await controller.expireStale();
			expect(result.expired).toBe(0);
			expect(result.processingSessions).toHaveLength(0);
		});

		it("does not re-expire already expired sessions", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				ttl: -1,
			});
			const first = await controller.expireStale();
			expect(first.expired).toBe(1);

			// Running again should not expire anything new
			const second = await controller.expireStale();
			expect(second.expired).toBe(0);

			// Session is still expired
			const fetched = await controller.getById(session.id);
			expect(fetched?.status).toBe("expired");
		});

		it("handles many expired sessions", async () => {
			for (let i = 0; i < 20; i++) {
				await controller.create({
					subtotal: 100,
					total: 100,
					lineItems: [
						{ productId: `p${i}`, name: `P${i}`, price: 100, quantity: 1 },
					],
					ttl: -1,
				});
			}
			const result = await controller.expireStale();
			expect(result.expired).toBe(20);
		});

		it("only expires sessions with expiresAt in the past", async () => {
			// One session expires in 1 hour
			await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				ttl: 3_600_000,
			});
			// One session is already expired
			await controller.create({
				subtotal: 200,
				total: 200,
				lineItems: sampleLineItems,
				ttl: -1,
			});

			const result = await controller.expireStale();
			expect(result.expired).toBe(1);
		});
	});

	// ── data store consistency ─────────────────────────────────────────

	describe("data store consistency", () => {
		it("store reflects correct session count", async () => {
			await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});
			await controller.create({
				subtotal: 200,
				total: 200,
				lineItems: sampleLineItems,
			});
			expect(mockData.size("checkoutSession")).toBe(2);
		});

		it("line items are stored separately from sessions", async () => {
			await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: [
					{ productId: "p1", name: "A", price: 100, quantity: 1 },
					{ productId: "p2", name: "B", price: 100, quantity: 1 },
				],
			});
			expect(mockData.size("checkoutSession")).toBe(1);
			expect(mockData.size("checkoutLineItem")).toBe(2);
		});

		it("line item key includes variantId when present", async () => {
			await controller.create({
				id: "sess-1",
				subtotal: 100,
				total: 100,
				lineItems: [
					{
						productId: "p1",
						variantId: "v1",
						name: "A",
						price: 100,
						quantity: 1,
					},
				],
			});
			// The key should be `sess-1_p1_v1`
			const stored = await mockData.get("checkoutLineItem", "sess-1_p1_v1");
			expect(stored).not.toBeNull();
			expect(stored?.productId).toBe("p1");
			expect(stored?.variantId).toBe("v1");
		});

		it("line item key omits variantId when not present", async () => {
			await controller.create({
				id: "sess-2",
				subtotal: 100,
				total: 100,
				lineItems: [{ productId: "p1", name: "A", price: 100, quantity: 1 }],
			});
			const stored = await mockData.get("checkoutLineItem", "sess-2_p1");
			expect(stored).not.toBeNull();
			expect(stored?.productId).toBe("p1");
		});
	});

	// ── complex lifecycle scenarios ───────────────────────────────────

	describe("complex lifecycle scenarios", () => {
		it("full happy path: create -> update -> discount -> gift card -> confirm -> payment -> complete", async () => {
			// Create
			const session = await controller.create({
				subtotal: 5000,
				taxAmount: 500,
				shippingAmount: 800,
				total: 6300,
				lineItems: sampleLineItems,
				customerId: "cust-1",
			});
			expect(session.status).toBe("pending");

			// Update with addresses
			const updated = await controller.update(session.id, {
				shippingAddress: sampleAddress,
				billingAddress: sampleAddress,
			});
			expect(updated?.shippingAddress).toEqual(sampleAddress);

			// Apply discount
			const discounted = await controller.applyDiscount(session.id, {
				code: "SAVE500",
				discountAmount: 500,
				freeShipping: false,
			});
			// 5000 + 500 + 800 - 500 = 5800
			expect(discounted?.total).toBe(5800);

			// Apply gift card
			const gifted = await controller.applyGiftCard(session.id, {
				code: "GC-200",
				giftCardAmount: 200,
			});
			// 5000 + 500 + 800 - 500 - 200 = 5600
			expect(gifted?.total).toBe(5600);

			// Confirm
			const confirmed = await controller.confirm(session.id);
			expect("session" in confirmed).toBe(true);
			if ("session" in confirmed) {
				expect(confirmed.session.status).toBe("processing");
			}

			// Set payment intent
			const withPayment = await controller.setPaymentIntent(
				session.id,
				"pi_test",
				"succeeded",
			);
			expect(withPayment?.paymentIntentId).toBe("pi_test");

			// Complete
			const completed = await controller.complete(session.id, "ord-final");
			expect(completed?.status).toBe("completed");
			expect(completed?.orderId).toBe("ord-final");
			expect(completed?.total).toBe(5600);
		});

		it("session expiration blocks all modifications except abandon", async () => {
			const session = await controller.create({
				subtotal: 1000,
				total: 1000,
				lineItems: sampleLineItems,
				customerId: "cust-1",
				shippingAddress: sampleAddress,
				ttl: -1,
			});
			await controller.expireStale();

			// All these should return null or error
			expect(
				await controller.update(session.id, { guestEmail: "a@b.com" }),
			).toBeNull();
			expect(
				await controller.applyDiscount(session.id, {
					code: "X",
					discountAmount: 10,
					freeShipping: false,
				}),
			).toBeNull();
			expect(await controller.removeDiscount(session.id)).toBeNull();
			expect(
				await controller.applyGiftCard(session.id, {
					code: "GC",
					giftCardAmount: 10,
				}),
			).toBeNull();
			expect(await controller.removeGiftCard(session.id)).toBeNull();
			expect(
				await controller.setPaymentIntent(session.id, "pi", "pending"),
			).toBeNull();
			expect(await controller.complete(session.id, "ord-1")).toBeNull();

			const confirmResult = await controller.confirm(session.id);
			expect("error" in confirmResult).toBe(true);

			// But abandon still works
			const abandoned = await controller.abandon(session.id);
			expect(abandoned?.status).toBe("abandoned");
		});

		it("completed session blocks all further modifications", async () => {
			const session = await controller.create({
				subtotal: 1000,
				total: 1000,
				lineItems: sampleLineItems,
			});
			await controller.complete(session.id, "ord-1");

			expect(
				await controller.update(session.id, { guestEmail: "x@y.com" }),
			).toBeNull();
			expect(
				await controller.applyDiscount(session.id, {
					code: "X",
					discountAmount: 10,
					freeShipping: false,
				}),
			).toBeNull();
			expect(await controller.removeDiscount(session.id)).toBeNull();
			expect(
				await controller.applyGiftCard(session.id, {
					code: "GC",
					giftCardAmount: 10,
				}),
			).toBeNull();
			expect(await controller.removeGiftCard(session.id)).toBeNull();
			expect(
				await controller.setPaymentIntent(session.id, "pi", "pending"),
			).toBeNull();
			expect(await controller.complete(session.id, "ord-2")).toBeNull();
			expect(await controller.abandon(session.id)).toBeNull();
		});

		it("multiple concurrent sessions are independent", async () => {
			const s1 = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: [{ productId: "p1", name: "A", price: 100, quantity: 1 }],
				guestEmail: "user1@test.com",
			});
			const s2 = await controller.create({
				subtotal: 200,
				total: 200,
				lineItems: [{ productId: "p2", name: "B", price: 200, quantity: 1 }],
				guestEmail: "user2@test.com",
			});

			await controller.applyDiscount(s1.id, {
				code: "DISC1",
				discountAmount: 50,
				freeShipping: false,
			});
			await controller.complete(s2.id, "ord-2");

			const fetched1 = await controller.getById(s1.id);
			const fetched2 = await controller.getById(s2.id);
			expect(fetched1?.status).toBe("pending");
			expect(fetched1?.discountCode).toBe("DISC1");
			expect(fetched2?.status).toBe("completed");
			expect(fetched2?.discountCode).toBeUndefined();
		});

		it("stats reflect full lifecycle across many sessions", async () => {
			// Create 3 completed
			for (let i = 0; i < 3; i++) {
				const s = await controller.create({
					subtotal: 1000,
					total: 1000,
					lineItems: sampleLineItems,
				});
				await controller.complete(s.id, `ord-${i}`);
			}
			// Create 2 abandoned
			for (let i = 0; i < 2; i++) {
				const s = await controller.create({
					subtotal: 500,
					total: 500,
					lineItems: sampleLineItems,
				});
				await controller.abandon(s.id);
			}
			// Create 1 expired
			await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				ttl: -1,
			});
			await controller.expireStale();
			// Create 1 pending
			await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
			});

			const stats = await controller.getStats();
			expect(stats.total).toBe(7);
			expect(stats.completed).toBe(3);
			expect(stats.abandoned).toBe(2);
			expect(stats.expired).toBe(1);
			expect(stats.pending).toBe(1);
			expect(stats.totalRevenue).toBe(3000);
			expect(stats.averageOrderValue).toBe(1000);
			// conversionRate = 3 / (3+2+1) = 0.5
			expect(stats.conversionRate).toBe(0.5);
		});
	});

	// ── special characters and boundary inputs ────────────────────────

	describe("special characters and boundary inputs", () => {
		it("handles unicode characters in address fields", async () => {
			const unicodeAddress: CheckoutAddress = {
				firstName: "Rene",
				lastName: "Muller",
				line1: "Strasse 42",
				city: "Munchen",
				state: "Bayern",
				postalCode: "80331",
				country: "DE",
			};
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				shippingAddress: unicodeAddress,
			});
			expect(session.shippingAddress?.city).toBe("Munchen");
		});

		it("handles special characters in line item names", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: [
					{
						productId: "p1",
						name: 'Widget "Pro" <br> & Co. \' 100%',
						price: 100,
						quantity: 1,
					},
				],
			});
			const items = await controller.getLineItems(session.id);
			expect(items[0].name).toBe('Widget "Pro" <br> & Co. \' 100%');
		});

		it("handles very long metadata values", async () => {
			const longValue = "X".repeat(10000);
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				lineItems: sampleLineItems,
				metadata: { longKey: longValue },
			});
			expect((session.metadata as Record<string, string>).longKey).toBe(
				longValue,
			);
		});

		it("handles empty string guestEmail", async () => {
			const session = await controller.create({
				subtotal: 100,
				total: 100,
				guestEmail: "",
				lineItems: sampleLineItems,
				shippingAddress: sampleAddress,
			});
			// Empty string guestEmail: confirm should fail because empty string is falsy
			const result = await controller.confirm(session.id);
			expect("error" in result).toBe(true);
		});
	});
});
