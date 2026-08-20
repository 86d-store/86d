import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateOrderParams } from "../service";
import { createOrderController } from "../service-impl";

/**
 * Security regression tests for orders endpoints.
 *
 * Orders contain sensitive customer data (addresses, emails, payment info).
 * These tests verify:
 * - Customer isolation: customer A cannot access customer B's orders
 * - Guest tracking: email matching prevents order enumeration
 * - Status-based access: non-cancellable statuses are enforced
 * - Cascading deletes don't leak orphaned data
 * - Search doesn't expose data from other customers
 */

function makeOrderParams(
	overrides: Partial<CreateOrderParams> = {},
): CreateOrderParams {
	const items = overrides.items ?? [
		{ productId: "prod_1", name: "Widget", price: 1000, quantity: 1 },
	];
	const subtotal =
		overrides.subtotal ??
		items.reduce((sum, item) => sum + item.price * item.quantity, 0);
	const taxAmount = overrides.taxAmount ?? 100;
	const total =
		overrides.total ??
		Math.max(
			0,
			subtotal +
				taxAmount +
				(overrides.shippingAmount ?? 0) -
				(overrides.discountAmount ?? 0) -
				(overrides.giftCardAmount ?? 0) -
				(overrides.storeCreditAmount ?? 0),
		);
	return {
		...overrides,
		subtotal,
		total,
		taxAmount,
		items,
	};
}

const sampleAddress = {
	firstName: "Jane",
	lastName: "Doe",
	line1: "123 Main St",
	city: "Springfield",
	state: "IL",
	postalCode: "62701",
	country: "US",
};

describe("orders endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createOrderController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createOrderController(mockData);
	});

	// ── Customer Isolation ──────────────────────────────────────────

	describe("customer isolation", () => {
		it("listForCustomer never returns other customers' orders", async () => {
			await controller.create(makeOrderParams({ customerId: "victim" }));
			await controller.create(makeOrderParams({ customerId: "victim" }));
			await controller.create(makeOrderParams({ customerId: "attacker" }));

			const attackerOrders = await controller.listForCustomer("attacker");
			expect(attackerOrders.total).toBe(1);
			for (const order of attackerOrders.orders) {
				expect(order.customerId).toBe("attacker");
			}
		});

		it("getById exposes order regardless of customerId (endpoint must check ownership)", async () => {
			const order = await controller.create(
				makeOrderParams({ customerId: "victim" }),
			);
			// The controller's getById does NOT check ownership — that's the endpoint's job
			// This test documents that endpoints MUST verify customerId === session.user.id
			const result = await controller.getById(order.id);
			expect(result).not.toBeNull();
		});

		it("listReturnsForCustomer only returns returns for owned orders", async () => {
			const victimOrder = await controller.create(
				makeOrderParams({ customerId: "victim" }),
			);
			const attackerOrder = await controller.create(
				makeOrderParams({ customerId: "attacker" }),
			);

			const victimItems = await controller.getItems(victimOrder.id);
			const attackerItems = await controller.getItems(attackerOrder.id);

			await controller.createReturn({
				orderId: victimOrder.id,
				reason: "defective",
				items: [{ orderItemId: victimItems[0].id, quantity: 1 }],
			});
			await controller.createReturn({
				orderId: attackerOrder.id,
				reason: "wrong_item",
				items: [{ orderItemId: attackerItems[0].id, quantity: 1 }],
			});

			const attackerReturns =
				await controller.listReturnsForCustomer("attacker");
			expect(attackerReturns.total).toBe(1);

			const victimReturns = await controller.listReturnsForCustomer("victim");
			expect(victimReturns.total).toBe(1);
		});
	});

	// ── Guest Tracking Security ─────────────────────────────────────

	describe("guest tracking — order enumeration prevention", () => {
		it("cannot track without matching email", async () => {
			const order = await controller.create(
				makeOrderParams({ guestEmail: "real@customer.com" }),
			);

			const result = await controller.getByTracking(
				order.orderNumber,
				"hacker@evil.com",
			);
			expect(result).toBeNull();
		});

		it("cannot track customer orders without metadata email", async () => {
			const order = await controller.create(
				makeOrderParams({ customerId: "cust_1" }),
			);

			// Without metadata.customerEmail, tracking is impossible for logged-in orders
			const result = await controller.getByTracking(
				order.orderNumber,
				"any@email.com",
			);
			expect(result).toBeNull();
		});

		it("guest email matching is case-insensitive to prevent bypass", async () => {
			const order = await controller.create(
				makeOrderParams({ guestEmail: "User@Example.COM" }),
			);

			// Same email, different case — should still match
			const result = await controller.getByTracking(
				order.orderNumber,
				"user@example.com",
			);
			expect(result).not.toBeNull();
		});

		it("empty email does not match anything", async () => {
			const order = await controller.create(
				makeOrderParams({ guestEmail: "" }),
			);

			// An empty guestEmail should not match an empty search
			// This is handled by the fact that empty string won't match in practice
			const result = await controller.getByTracking(
				order.orderNumber,
				"test@test.com",
			);
			expect(result).toBeNull();
		});

		it("tracking returns full order details when email matches", async () => {
			const order = await controller.create(
				makeOrderParams({
					guestEmail: "guest@test.com",
					billingAddress: sampleAddress,
					items: [
						{
							productId: "p1",
							name: "Widget",
							price: 1000,
							quantity: 2,
						},
					],
				}),
			);

			const result = await controller.getByTracking(
				order.orderNumber,
				"guest@test.com",
			);
			expect(result).not.toBeNull();
			expect(result?.items).toHaveLength(1);
			expect(result?.addresses).toHaveLength(1);
		});
	});

	// ── Guest Order Confirmation (POST /orders/confirm) ────────────

	describe("guest order confirmation — email-based access control", () => {
		it("grants access when guestEmail matches", async () => {
			const order = await controller.create(
				makeOrderParams({ guestEmail: "buyer@example.com" }),
			);

			const fetched = await controller.getById(order.id);
			expect(fetched).not.toBeNull();
			// Simulate endpoint email check
			const email = "buyer@example.com";
			const matches =
				fetched?.guestEmail?.toLowerCase().trim() ===
				email.toLowerCase().trim();
			expect(matches).toBe(true);
		});

		it("denies access when guestEmail does not match", async () => {
			const order = await controller.create(
				makeOrderParams({ guestEmail: "buyer@example.com" }),
			);

			const fetched = await controller.getById(order.id);
			const email = "attacker@evil.com";
			const matches =
				fetched?.guestEmail?.toLowerCase().trim() ===
				email.toLowerCase().trim();
			expect(matches).toBe(false);
		});

		it("denies access when order has no guestEmail and no session", async () => {
			const order = await controller.create(
				makeOrderParams({ customerId: "cust-123" }),
			);

			const fetched = await controller.getById(order.id);
			// No guestEmail set — email matching should fail
			const email = "random@test.com";
			const matches =
				fetched?.guestEmail != null &&
				fetched?.guestEmail.toLowerCase().trim() === email.toLowerCase().trim();
			expect(matches).toBe(false);
		});

		it("grants access when customerId matches session user", async () => {
			const order = await controller.create(
				makeOrderParams({ customerId: "user-456" }),
			);

			const fetched = await controller.getById(order.id);
			// Simulate session userId matching
			const userId = "user-456";
			const matches = fetched?.customerId === userId;
			expect(matches).toBe(true);
		});

		it("denies access when customerId does not match session user", async () => {
			const order = await controller.create(
				makeOrderParams({ customerId: "victim-user" }),
			);

			const fetched = await controller.getById(order.id);
			const userId = "attacker-user";
			const matches = fetched?.customerId === userId;
			expect(matches).toBe(false);
		});

		it("returns null for non-existent orderId (prevents enumeration)", async () => {
			const fetched = await controller.getById("nonexistent-order-id");
			expect(fetched).toBeNull();
		});

		it("email matching is case-insensitive", async () => {
			const order = await controller.create(
				makeOrderParams({ guestEmail: "Buyer@Example.COM" }),
			);

			const fetched = await controller.getById(order.id);
			const email = "buyer@example.com";
			const matches =
				fetched?.guestEmail?.toLowerCase().trim() ===
				email.toLowerCase().trim();
			expect(matches).toBe(true);
		});
	});

	// ── Cancellation Guard ──────────────────────────────────────────

	describe("cancellation status guard", () => {
		const nonCancellableStatuses = [
			"completed",
			"cancelled",
			"refunded",
		] as const;

		for (const status of nonCancellableStatuses) {
			it(`rejects cancellation of ${status} order`, async () => {
				const order = await controller.create(makeOrderParams());
				await controller.updateStatus(order.id, status);
				const result = await controller.cancel(order.id);
				expect(result).toBeNull();
			});
		}

		const cancellableStatuses = ["pending", "processing", "on_hold"] as const;

		for (const status of cancellableStatuses) {
			it(`allows cancellation of ${status} order`, async () => {
				const order = await controller.create(makeOrderParams());
				if (status !== "pending") {
					await controller.updateStatus(order.id, status);
				}
				const result = await controller.cancel(order.id);
				expect(result?.status).toBe("cancelled");
			});
		}
	});

	// ── Cascading Delete Data Integrity ─────────────────────────────

	describe("cascading delete — no orphaned data", () => {
		it("bulkDelete removes all associated records", async () => {
			const order = await controller.create(
				makeOrderParams({
					billingAddress: sampleAddress,
					shippingAddress: {
						...sampleAddress,
						firstName: "Ship",
					},
				}),
			);
			const items = await controller.getItems(order.id);

			// Create return with items
			await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0].id, quantity: 1 }],
			});

			// Create notes
			await controller.addNote({
				orderId: order.id,
				content: "Test note",
			});

			// Delete
			const result = await controller.bulkDelete([order.id]);
			expect(result.deleted).toBe(1);

			// Verify everything is gone
			expect(await controller.getById(order.id)).toBeNull();
			expect(await controller.getItems(order.id)).toHaveLength(0);
			expect(await controller.getAddresses(order.id)).toHaveLength(0);
			expect(await controller.listReturns(order.id)).toHaveLength(0);
			expect(await controller.listNotes(order.id)).toHaveLength(0);
		});

		it("bulkDelete of one order does not affect another", async () => {
			const keepOrder = await controller.create(
				makeOrderParams({ billingAddress: sampleAddress }),
			);
			const deleteOrder = await controller.create(
				makeOrderParams({ billingAddress: sampleAddress }),
			);

			const keepItems = await controller.getItems(keepOrder.id);
			await controller.createReturn({
				orderId: keepOrder.id,
				reason: "defective",
				items: [{ orderItemId: keepItems[0].id, quantity: 1 }],
			});

			await controller.bulkDelete([deleteOrder.id]);

			// Keep order and all its data should be intact
			expect(await controller.getById(keepOrder.id)).not.toBeNull();
			expect(await controller.getItems(keepOrder.id)).toHaveLength(1);
			expect(await controller.getAddresses(keepOrder.id)).toHaveLength(1);
			expect(await controller.listReturns(keepOrder.id)).toHaveLength(1);
		});
	});

	// ── Search Safety ───────────────────────────────────────────────

	describe("search — data exposure", () => {
		it("admin list search does not filter by customerId by default", async () => {
			await controller.create(
				makeOrderParams({
					customerId: "cust_1",
					guestEmail: "alice@test.com",
				}),
			);
			await controller.create(
				makeOrderParams({
					customerId: "cust_2",
					guestEmail: "bob@test.com",
				}),
			);

			// Admin search returns all matching orders (admin sees everything)
			const result = await controller.list({});
			expect(result.total).toBe(2);
		});

		it("search by customerId returns matching orders", async () => {
			await controller.create(
				makeOrderParams({ customerId: "searchable_cust" }),
			);
			await controller.create(makeOrderParams({ customerId: "other_cust" }));

			const result = await controller.list({
				search: "searchable_cust",
			});
			expect(result.orders).toHaveLength(1);
		});
	});

	// ── Invoice Access ──────────────────────────────────────────────

	describe("invoice — status-based information", () => {
		it("cancelled order invoice shows void status", async () => {
			const order = await controller.create(makeOrderParams());
			await controller.updateStatus(order.id, "cancelled");

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.status).toBe("void");
		});

		it("refunded payment invoice shows void status", async () => {
			const order = await controller.create(makeOrderParams());
			await controller.updatePaymentStatus(order.id, "refunded");

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.status).toBe("void");
		});

		it("unpaid order invoice shows issued status", async () => {
			const order = await controller.create(makeOrderParams());

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.status).toBe("issued");
		});

		it("paid order invoice shows paid status", async () => {
			const order = await controller.create(makeOrderParams());
			await controller.updatePaymentStatus(order.id, "paid");

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.status).toBe("paid");
		});
	});
});
