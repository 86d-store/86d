import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { performCancellationEffects } from "../cancel-effects";
import type {
	CreateOrderParams,
	InventoryReleaseController,
	OrderWithDetails,
	PaymentRefundController,
} from "../service";
import { createOrderController } from "../service-impl";

const sampleAddress = {
	firstName: "John",
	lastName: "Doe",
	line1: "123 Main St",
	city: "Springfield",
	state: "IL",
	postalCode: "62701",
	country: "US",
};

const sampleItems: CreateOrderParams["items"] = [
	{ productId: "prod_1", name: "Widget", price: 1999, quantity: 2 },
	{
		productId: "prod_2",
		variantId: "var_1",
		name: "Gadget",
		price: 999,
		quantity: 1,
	},
];

function makePaymentController(
	overrides: Partial<PaymentRefundController> = {},
): PaymentRefundController {
	return {
		listIntents: vi.fn().mockResolvedValue([]),
		createRefund: vi.fn().mockResolvedValue({
			id: "refund_1",
			amount: 4997,
			status: "succeeded",
		}),
		...overrides,
	};
}

function makeInventoryController(
	overrides: Partial<InventoryReleaseController> = {},
): InventoryReleaseController {
	return {
		release: vi.fn().mockResolvedValue({ id: "inv_1" }),
		...overrides,
	};
}

describe("performCancellationEffects", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let orderController: ReturnType<typeof createOrderController>;

	beforeEach(() => {
		mockData = createMockDataService();
		orderController = createOrderController(mockData);
	});

	async function createPaidOrder(
		metadata?: Record<string, unknown>,
	): Promise<OrderWithDetails> {
		const order = await orderController.create({
			customerId: "cust_1",
			subtotal: 4997,
			total: 4997,
			items: sampleItems,
			shippingAddress: sampleAddress,
			metadata,
		});

		// Set payment status to paid
		await orderController.updatePaymentStatus(order.id, "paid");

		const full = await orderController.getById(order.id);
		return full as OrderWithDetails;
	}

	async function createUnpaidOrder(): Promise<OrderWithDetails> {
		const order = await orderController.create({
			customerId: "cust_1",
			subtotal: 4997,
			total: 4997,
			items: sampleItems,
		});

		const full = await orderController.getById(order.id);
		return full as OrderWithDetails;
	}

	// ── Refund via metadata paymentIntentId ──────────────────────────

	it("refunds payment when order has paymentIntentId in metadata", async () => {
		const order = await createPaidOrder({
			paymentIntentId: "pi_123",
		});

		const paymentController = makePaymentController();

		const result = await performCancellationEffects({
			order,
			orderController,
			paymentController,
			inventoryController: undefined,
			cancelledBy: "customer",
		});

		expect(result.refundCreated).toBe(true);
		expect(result.refundAmount).toBe(4997);
		expect(paymentController.createRefund).toHaveBeenCalledWith({
			intentId: "pi_123",
			reason: expect.stringContaining("cancelled by customer"),
		});
	});

	// ── Refund via listIntents fallback ──────────────────────────────

	it("falls back to listIntents when metadata has no paymentIntentId", async () => {
		const order = await createPaidOrder();

		const paymentController = makePaymentController({
			listIntents: vi
				.fn()
				.mockResolvedValue([
					{ id: "pi_456", status: "succeeded", amount: 4997 },
				]),
		});

		const result = await performCancellationEffects({
			order,
			orderController,
			paymentController,
			inventoryController: undefined,
			cancelledBy: "admin",
		});

		expect(result.refundCreated).toBe(true);
		expect(paymentController.listIntents).toHaveBeenCalledWith({
			orderId: order.id,
			status: "succeeded",
		});
		expect(paymentController.createRefund).toHaveBeenCalledWith({
			intentId: "pi_456",
			reason: expect.stringContaining("cancelled by admin"),
		});
	});

	// ── Refund fallback when metadata intent fails ───────────────────

	it("falls back to listIntents when metadata intent refund throws", async () => {
		const order = await createPaidOrder({
			paymentIntentId: "pi_stale",
		});

		const paymentController = makePaymentController({
			createRefund: vi
				.fn()
				.mockRejectedValueOnce(new Error("Intent not found"))
				.mockResolvedValueOnce({
					id: "refund_2",
					amount: 4997,
					status: "succeeded",
				}),
			listIntents: vi
				.fn()
				.mockResolvedValue([
					{ id: "pi_real", status: "succeeded", amount: 4997 },
				]),
		});

		const result = await performCancellationEffects({
			order,
			orderController,
			paymentController,
			inventoryController: undefined,
			cancelledBy: "admin",
		});

		expect(result.refundCreated).toBe(true);
		expect(paymentController.createRefund).toHaveBeenCalledTimes(2);
	});

	// ── Payment status updated to refunded ──────────────────────────

	it("updates order payment status to refunded after successful refund", async () => {
		const order = await createPaidOrder({
			paymentIntentId: "pi_123",
		});

		await performCancellationEffects({
			order,
			orderController,
			paymentController: makePaymentController(),
			inventoryController: undefined,
			cancelledBy: "customer",
		});

		const updated = await orderController.getById(order.id);
		expect(updated?.paymentStatus).toBe("refunded");
	});

	// ── Inventory release ───────────────────────────────────────────

	it("releases reserved inventory for all order items", async () => {
		const order = await createPaidOrder();
		const inventoryController = makeInventoryController();

		const result = await performCancellationEffects({
			order,
			orderController,
			paymentController: undefined,
			inventoryController,
			cancelledBy: "admin",
		});

		expect(result.inventoryReleased).toBe(true);
		expect(inventoryController.release).toHaveBeenCalledTimes(2);
		expect(inventoryController.release).toHaveBeenCalledWith({
			productId: "prod_1",
			variantId: undefined,
			quantity: 2,
		});
		expect(inventoryController.release).toHaveBeenCalledWith({
			productId: "prod_2",
			variantId: "var_1",
			quantity: 1,
		});
	});

	// ── System note added ───────────────────────────────────────────

	it("adds a system note documenting the cancellation", async () => {
		const order = await createPaidOrder({
			paymentIntentId: "pi_123",
		});
		const inventoryController = makeInventoryController();

		await performCancellationEffects({
			order,
			orderController,
			paymentController: makePaymentController(),
			inventoryController,
			cancelledBy: "customer",
		});

		const notes = await orderController.listNotes(order.id);
		expect(notes).toHaveLength(1);
		expect(notes[0]?.type).toBe("system");
		expect(notes[0]?.content).toContain("cancelled by customer");
		expect(notes[0]?.content).toContain("Refund of");
		expect(notes[0]?.content).toContain("inventory released");
	});

	// ── No refund for unpaid orders ─────────────────────────────────

	it("does not attempt refund for unpaid orders", async () => {
		const order = await createUnpaidOrder();
		const paymentController = makePaymentController();

		const result = await performCancellationEffects({
			order,
			orderController,
			paymentController,
			inventoryController: undefined,
			cancelledBy: "customer",
		});

		expect(result.refundCreated).toBe(false);
		expect(result.refundAmount).toBe(0);
		expect(paymentController.createRefund).not.toHaveBeenCalled();
		expect(paymentController.listIntents).not.toHaveBeenCalled();
	});

	// ── Graceful without payment controller ─────────────────────────

	it("works without payment controller installed", async () => {
		const order = await createPaidOrder({
			paymentIntentId: "pi_123",
		});

		const result = await performCancellationEffects({
			order,
			orderController,
			paymentController: undefined,
			inventoryController: undefined,
			cancelledBy: "admin",
		});

		expect(result.refundCreated).toBe(false);
		expect(result.inventoryReleased).toBe(false);
	});

	// ── Graceful without inventory controller ───────────────────────

	it("works without inventory controller installed", async () => {
		const order = await createPaidOrder();

		const result = await performCancellationEffects({
			order,
			orderController,
			paymentController: undefined,
			inventoryController: undefined,
			cancelledBy: "customer",
		});

		expect(result.inventoryReleased).toBe(false);
	});

	// ── Note mentions failed refund ─────────────────────────────────

	it("notes when automatic refund could not be processed", async () => {
		const order = await createPaidOrder({
			paymentIntentId: "pi_123",
		});

		const paymentController = makePaymentController({
			createRefund: vi.fn().mockRejectedValue(new Error("Provider error")),
			listIntents: vi.fn().mockResolvedValue([]),
		});

		await performCancellationEffects({
			order,
			orderController,
			paymentController,
			inventoryController: undefined,
			cancelledBy: "admin",
		});

		const notes = await orderController.listNotes(order.id);
		expect(notes[0]?.content).toContain(
			"Automatic refund could not be processed",
		);
	});

	// ── Both refund and inventory together ───────────────────────────

	it("handles both refund and inventory release in one call", async () => {
		const order = await createPaidOrder({
			paymentIntentId: "pi_123",
		});

		const paymentController = makePaymentController();
		const inventoryController = makeInventoryController();

		const result = await performCancellationEffects({
			order,
			orderController,
			paymentController,
			inventoryController,
			cancelledBy: "admin",
		});

		expect(result.refundCreated).toBe(true);
		expect(result.inventoryReleased).toBe(true);

		const notes = await orderController.listNotes(order.id);
		expect(notes[0]?.content).toContain("Refund of");
		expect(notes[0]?.content).toContain("inventory released");

		const updated = await orderController.getById(order.id);
		expect(updated?.paymentStatus).toBe("refunded");
	});
});
