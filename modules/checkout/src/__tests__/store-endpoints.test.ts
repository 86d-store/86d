import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	CheckoutLineItem,
	CheckoutSession,
	DiscountController,
	InventoryCheckController,
} from "../service";
import { createCheckoutController } from "../service-impl";
import { checkoutActivationUnavailable } from "../store/endpoints/activation-unavailable";
import { completeSession } from "../store/endpoints/complete-session";
import { storeEndpoints } from "../store/endpoints/routes";
import { seedLegacyStoredGiftCard } from "./legacy-gift-card-test-utils";

/**
 * Store endpoint integration tests for the checkout module.
 *
 * These tests verify the business logic in store-facing endpoints that
 * goes beyond simple controller delegation:
 *
 * 1. create-session: server-side price validation, empty cart rejection,
 *    total recalculation from trusted prices, guest vs authenticated
 * 2. get-session: ownership check, line items returned alongside session
 * 3. confirm-session: inventory stock check before confirm, reservation
 * 4. complete-session: explicit activation containment without side effects
 * 5. apply-discount: discount code validation through discount controller
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ───────────────────────────────────────────────────────────

function defaultLineItem(
	overrides: Partial<CheckoutLineItem> = {},
): CheckoutLineItem {
	return {
		productId: "prod-1",
		name: "Test Product",
		price: 2500,
		quantity: 1,
		...overrides,
	};
}

const testAddress = {
	firstName: "Jane",
	lastName: "Doe",
	line1: "123 Main St",
	city: "Anytown",
	state: "CA",
	postalCode: "90210",
	country: "US",
};

async function createTestSession(
	controller: ReturnType<typeof createCheckoutController>,
	overrides: Partial<Parameters<typeof controller.create>[0]> = {},
) {
	const defaults = {
		subtotal: 2500,
		total: 2500,
		lineItems: [defaultLineItem()],
		guestEmail: "guest@example.com",
		shippingAddress: testAddress,
		...overrides,
	};
	return controller.create(defaults);
}

// ── Simulate endpoint logic ──────────────────────────────────────────

/**
 * Simulates create-session endpoint: validates prices against products
 * data registry, rejects empty carts, recalculates totals server-side.
 */
async function simulateCreateSession(
	data: DataService,
	body: {
		lineItems: Array<{
			productId: string;
			variantId?: string | undefined;
			name: string;
			sku?: string | undefined;
			price: number;
			quantity: number;
		}>;
		subtotal: number;
		total: number;
		taxAmount?: number;
		shippingAmount?: number;
		guestEmail?: string;
		currency?: string;
		shippingAddress?: typeof testAddress;
		billingAddress?: typeof testAddress;
		cartId?: string;
	},
	opts: {
		customerId?: string;
		productsData?: DataService;
	} = {},
) {
	const controller = createCheckoutController(data);

	if (body.lineItems.length === 0) {
		return { error: "Cart is empty", status: 400 };
	}

	// Server-side price validation
	if (opts.productsData) {
		for (const item of body.lineItems) {
			let trustedPrice: number | undefined;
			if (item.variantId) {
				const variant = (await opts.productsData.get(
					"productVariant",
					item.variantId,
				)) as { price: number } | null;
				if (variant) trustedPrice = variant.price;
			}
			if (trustedPrice === undefined) {
				const product = (await opts.productsData.get(
					"product",
					item.productId,
				)) as { price: number } | null;
				if (!product) {
					return { error: `Product not found: ${item.name}`, status: 400 };
				}
				trustedPrice = product.price;
			}
			item.price = trustedPrice;
		}
	}

	// Recalculate totals server-side
	const subtotal = body.lineItems.reduce(
		(sum, item) => sum + item.price * item.quantity,
		0,
	);
	const taxAmount = body.taxAmount ?? 0;
	const shippingAmount = body.shippingAmount ?? 0;
	const total = subtotal + taxAmount + shippingAmount;

	const session = await controller.create({
		...(body.cartId ? { cartId: body.cartId } : {}),
		...(opts.customerId ? { customerId: opts.customerId } : {}),
		...(body.guestEmail ? { guestEmail: body.guestEmail } : {}),
		...(body.currency ? { currency: body.currency } : {}),
		subtotal,
		...(body.taxAmount !== undefined ? { taxAmount: body.taxAmount } : {}),
		...(body.shippingAmount !== undefined
			? { shippingAmount: body.shippingAmount }
			: {}),
		total,
		lineItems: body.lineItems,
		...(body.shippingAddress ? { shippingAddress: body.shippingAddress } : {}),
		...(body.billingAddress ? { billingAddress: body.billingAddress } : {}),
	});

	return { session };
}

/**
 * Simulates get-session endpoint: ownership check + returns line items.
 */
async function simulateGetSession(
	data: DataService,
	sessionId: string,
	userId?: string,
) {
	const controller = createCheckoutController(data);
	const session = await controller.getById(sessionId);
	if (!session) {
		return { error: "Checkout session not found", status: 404 };
	}

	if (session.customerId && (!userId || session.customerId !== userId)) {
		return { error: "Checkout session not found", status: 404 };
	}

	const lineItems = await controller.getLineItems(sessionId);
	return { session, lineItems };
}

/**
 * Simulates confirm-session endpoint: inventory check + reservation.
 */
async function simulateConfirmSession(
	data: DataService,
	sessionId: string,
	opts: {
		userId?: string;
		inventoryController?: InventoryCheckController;
	} = {},
) {
	const controller = createCheckoutController(data);
	const existing = await controller.getById(sessionId);
	if (!existing) {
		return { error: "Checkout session not found", status: 404 };
	}

	if (
		existing.customerId &&
		(!opts.userId || existing.customerId !== opts.userId)
	) {
		return { error: "Checkout session not found", status: 404 };
	}

	if (opts.inventoryController) {
		const lineItems = await controller.getLineItems(sessionId);
		const outOfStock: string[] = [];

		for (const item of lineItems) {
			const inStock = await opts.inventoryController.isInStock({
				productId: item.productId,
				variantId: item.variantId,
				quantity: item.quantity,
			});
			if (!inStock) {
				outOfStock.push(item.name);
			}
		}

		if (outOfStock.length > 0) {
			return {
				error: `Insufficient stock for: ${outOfStock.join(", ")}`,
				status: 422,
			};
		}
	}

	const result = await controller.confirm(sessionId);
	if ("error" in result) {
		return result;
	}

	if (opts.inventoryController) {
		const lineItems = await controller.getLineItems(sessionId);
		for (const item of lineItems) {
			await opts.inventoryController.reserve({
				productId: item.productId,
				variantId: item.variantId,
				quantity: item.quantity,
			});
		}
	}

	return { session: result.session };
}

/**
 * Simulates apply-discount endpoint: validates code through discount
 * controller, applies discount amount.
 */
async function simulateApplyDiscount(
	data: DataService,
	sessionId: string,
	code: string,
	opts: {
		userId?: string;
		discountController?: DiscountController;
	} = {},
) {
	const controller = createCheckoutController(data);
	const session = await controller.getById(sessionId);
	if (!session) {
		return { error: "Checkout session not found", status: 404 };
	}

	if (
		session.customerId &&
		(!opts.userId || session.customerId !== opts.userId)
	) {
		return { error: "Checkout session not found", status: 404 };
	}

	let discountAmount = 0;
	let freeShipping = false;

	if (opts.discountController) {
		const result = await opts.discountController.validateCode({
			code,
			subtotal: session.subtotal,
		});
		if (!result.valid) {
			return { error: result.error ?? "Invalid promo code", status: 400 };
		}
		discountAmount = result.discountAmount;
		freeShipping = result.freeShipping;
	}

	const updated = await controller.applyDiscount(sessionId, {
		code,
		discountAmount,
		freeShipping,
	});
	return { session: updated };
}

async function simulateRemoveDiscount(
	data: DataService,
	sessionId: string,
	opts: { userId?: string } = {},
) {
	const controller = createCheckoutController(data);
	const session = await controller.getById(sessionId);
	if (!session) {
		return { error: "Checkout session not found", status: 404 };
	}

	if (
		session.customerId &&
		(!opts.userId || session.customerId !== opts.userId)
	) {
		return { error: "Checkout session not found", status: 404 };
	}

	const updated = await controller.removeDiscount(sessionId);
	if (!updated) {
		return { error: "Cannot modify this checkout session", status: 422 };
	}

	return { session: updated };
}

async function simulateRemoveGiftCard(
	data: DataService,
	sessionId: string,
	opts: { userId?: string } = {},
) {
	const controller = createCheckoutController(data);
	const session = await controller.getById(sessionId);
	if (!session) {
		return { error: "Checkout session not found", status: 404 };
	}

	if (
		session.customerId &&
		(!opts.userId || session.customerId !== opts.userId)
	) {
		return { error: "Checkout session not found", status: 404 };
	}

	const updated = await controller.removeGiftCard(sessionId);
	if (!updated) {
		return { error: "Cannot modify this checkout session", status: 422 };
	}

	return { session: updated };
}

async function simulateApplyStoreCredit(
	data: DataService,
	sessionId: string,
	opts: {
		userId?: string;
		storeCreditBalance?: number;
	} = {},
) {
	const controller = createCheckoutController(data);
	const session = await controller.getById(sessionId);
	if (!session) {
		return { error: "Checkout session not found", status: 404 };
	}

	if (!opts.userId) {
		return { error: "Must be signed in to use store credits", status: 401 };
	}

	if (session.customerId && session.customerId !== opts.userId) {
		return { error: "Checkout session not found", status: 404 };
	}

	let storeCreditAmount = 0;
	if (opts.storeCreditBalance !== undefined) {
		if (opts.storeCreditBalance <= 0) {
			return { error: "No store credit balance available", status: 400 };
		}
		const remainingTotal =
			session.subtotal +
			session.taxAmount +
			session.shippingAmount -
			session.discountAmount -
			session.giftCardAmount;
		storeCreditAmount = Math.min(
			opts.storeCreditBalance,
			Math.max(0, remainingTotal),
		);
	}

	const updated = await controller.applyStoreCredit(sessionId, {
		storeCreditAmount,
	});

	return { session: updated };
}

async function simulateRemoveStoreCredit(
	data: DataService,
	sessionId: string,
	opts: { userId?: string } = {},
) {
	const controller = createCheckoutController(data);
	const session = await controller.getById(sessionId);
	if (!session) {
		return { error: "Checkout session not found", status: 404 };
	}

	if (
		session.customerId &&
		(!opts.userId || session.customerId !== opts.userId)
	) {
		return { error: "Checkout session not found", status: 404 };
	}

	const updated = await controller.removeStoreCredit(sessionId);
	if (!updated) {
		return { error: "Cannot modify this checkout session", status: 422 };
	}

	return { session: updated };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("checkout store endpoints", () => {
	let data: DataService;
	let controller: ReturnType<typeof createCheckoutController>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createCheckoutController(data);
	});

	// ── create-session ───────────────────────────────────────────────

	describe("create-session", () => {
		it("rejects empty cart", async () => {
			const result = await simulateCreateSession(data, {
				lineItems: [],
				subtotal: 0,
				total: 0,
			});
			expect(result).toEqual({ error: "Cart is empty", status: 400 });
		});

		it("creates session with guest email", async () => {
			const result = await simulateCreateSession(data, {
				lineItems: [
					{ productId: "p1", name: "Widget", price: 1000, quantity: 2 },
				],
				subtotal: 2000,
				total: 2000,
				guestEmail: "guest@shop.com",
			});
			expect("session" in result && result.session).toBeTruthy();
			const session = (result as { session: CheckoutSession }).session;
			expect(session.guestEmail).toBe("guest@shop.com");
			expect(session.customerId).toBeUndefined();
		});

		it("creates session with authenticated customerId", async () => {
			const result = await simulateCreateSession(
				data,
				{
					lineItems: [defaultLineItem()],
					subtotal: 2500,
					total: 2500,
				},
				{ customerId: "cust-1" },
			);
			const session = (result as { session: CheckoutSession }).session;
			expect(session.customerId).toBe("cust-1");
		});

		it("validates prices against products data registry", async () => {
			const productsData = createMockDataService();
			await productsData.upsert("product", "p1", {
				id: "p1",
				price: 3000,
				status: "active",
			});

			const result = await simulateCreateSession(
				data,
				{
					lineItems: [
						{
							productId: "p1",
							name: "Widget",
							price: 100, // Client lies about price
							quantity: 2,
						},
					],
					subtotal: 200,
					total: 200,
				},
				{ productsData },
			);

			const session = (result as { session: CheckoutSession }).session;
			// Server corrected to trusted price: 3000 * 2 = 6000
			expect(session.subtotal).toBe(6000);
			expect(session.total).toBe(6000);
		});

		it("validates variant prices over product prices", async () => {
			const productsData = createMockDataService();
			await productsData.upsert("product", "p1", {
				id: "p1",
				price: 2000,
			});
			await productsData.upsert("productVariant", "v1", {
				id: "v1",
				price: 2500,
			});

			const result = await simulateCreateSession(
				data,
				{
					lineItems: [
						{
							productId: "p1",
							variantId: "v1",
							name: "Widget (Large)",
							price: 100,
							quantity: 1,
						},
					],
					subtotal: 100,
					total: 100,
				},
				{ productsData },
			);

			const session = (result as { session: CheckoutSession }).session;
			expect(session.subtotal).toBe(2500);
		});

		it("rejects unknown product when products registry exists", async () => {
			const productsData = createMockDataService();

			const result = await simulateCreateSession(
				data,
				{
					lineItems: [
						{
							productId: "nonexistent",
							name: "Ghost Product",
							price: 1000,
							quantity: 1,
						},
					],
					subtotal: 1000,
					total: 1000,
				},
				{ productsData },
			);

			expect(result).toEqual({
				error: "Product not found: Ghost Product",
				status: 400,
			});
		});

		it("recalculates total including tax and shipping", async () => {
			const result = await simulateCreateSession(data, {
				lineItems: [
					{ productId: "p1", name: "Item", price: 5000, quantity: 1 },
				],
				subtotal: 5000,
				total: 5000,
				taxAmount: 400,
				shippingAmount: 500,
			});

			const session = (result as { session: CheckoutSession }).session;
			expect(session.subtotal).toBe(5000);
			expect(session.total).toBe(5900); // 5000 + 400 + 500
		});
	});

	// ── get-session ──────────────────────────────────────────────────

	describe("get-session", () => {
		it("returns 404 for nonexistent session", async () => {
			const result = await simulateGetSession(data, "no-such-id");
			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});

		it("returns session with line items", async () => {
			const session = await createTestSession(controller);
			const result = await simulateGetSession(data, session.id);

			expect("lineItems" in result).toBe(true);
			const res = result as {
				session: CheckoutSession;
				lineItems: CheckoutLineItem[];
			};
			expect(res.session.id).toBe(session.id);
			expect(res.lineItems).toHaveLength(1);
			expect(res.lineItems[0].productId).toBe("prod-1");
		});

		it("allows guest to access guest session", async () => {
			const session = await createTestSession(controller, {
				guestEmail: "guest@test.com",
			});
			// No userId — should still work since no customerId is set
			const result = await simulateGetSession(data, session.id);
			expect("session" in result).toBe(true);
		});

		it("blocks access to another customer's session", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-owner",
			});

			const result = await simulateGetSession(
				data,
				session.id,
				"cust-intruder",
			);
			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});

		it("allows owner to access their own session", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-owner",
			});

			const result = await simulateGetSession(data, session.id, "cust-owner");
			expect("session" in result).toBe(true);
		});
	});

	// ── confirm-session ──────────────────────────────────────────────

	describe("confirm-session", () => {
		it("blocks confirm when inventory is insufficient", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-1",
			});

			const inventoryController: InventoryCheckController = {
				isInStock: vi.fn().mockResolvedValue(false),
				reserve: vi.fn(),
				release: vi.fn(),
				deduct: vi.fn(),
			};

			const result = await simulateConfirmSession(data, session.id, {
				userId: "cust-1",
				inventoryController,
			});

			expect(result).toMatchObject({
				error: expect.stringContaining("Insufficient stock"),
				status: 422,
			});
		});

		it("lists all out-of-stock item names in error", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-1",
				lineItems: [
					defaultLineItem({ productId: "p1", name: "Widget A" }),
					defaultLineItem({ productId: "p2", name: "Widget B" }),
				],
			});

			const inventoryController: InventoryCheckController = {
				isInStock: vi.fn().mockResolvedValue(false),
				reserve: vi.fn(),
				release: vi.fn(),
				deduct: vi.fn(),
			};

			const result = await simulateConfirmSession(data, session.id, {
				userId: "cust-1",
				inventoryController,
			});

			expect(result).toMatchObject({
				error: "Insufficient stock for: Widget A, Widget B",
			});
		});

		it("reserves stock after successful confirm", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-1",
			});

			const reserveFn = vi.fn().mockResolvedValue({});
			const inventoryController: InventoryCheckController = {
				isInStock: vi.fn().mockResolvedValue(true),
				reserve: reserveFn,
				release: vi.fn(),
				deduct: vi.fn(),
			};

			const result = await simulateConfirmSession(data, session.id, {
				userId: "cust-1",
				inventoryController,
			});

			expect("session" in result).toBe(true);
			expect(reserveFn).toHaveBeenCalledWith(
				expect.objectContaining({
					productId: "prod-1",
					quantity: 1,
				}),
			);
		});

		it("confirms without inventory controller installed", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-1",
			});

			const result = await simulateConfirmSession(data, session.id, {
				userId: "cust-1",
			});

			const res = result as { session: CheckoutSession };
			expect(res.session.status).toBe("processing");
		});

		it("returns 404 for another customer's session", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-owner",
			});

			const result = await simulateConfirmSession(data, session.id, {
				userId: "cust-intruder",
			});
			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});
	});

	// ── complete-session containment ──────────────────────────────────

	describe("complete-session containment", () => {
		it("registers the package-exported fail-closed handler", () => {
			expect(storeEndpoints["/checkout/sessions/:id/complete"]).toBe(
				completeSession,
			);
		});

		it("returns the same bounded failure on retry without downstream effects", async () => {
			const downstream = vi.fn();
			const input = {
				params: { id: "session-1" },
				context: {
					controllers: {
						checkout: { getById: downstream, complete: downstream },
					},
				},
			};
			const endpoint = storeEndpoints["/checkout/sessions/:id/complete"];

			await expect(endpoint(input)).resolves.toEqual(
				checkoutActivationUnavailable,
			);
			await expect(endpoint(input)).resolves.toEqual(
				checkoutActivationUnavailable,
			);
			expect(downstream).not.toHaveBeenCalled();
		});
	});

	// ── apply-discount ───────────────────────────────────────────────

	describe("apply-discount", () => {
		it("applies discount with valid code", async () => {
			const session = await createTestSession(controller, {
				subtotal: 5000,
				total: 5000,
			});

			const discountController: DiscountController = {
				validateCode: vi.fn().mockResolvedValue({
					valid: true,
					discountAmount: 1000,
					freeShipping: false,
				}),
				applyCode: vi.fn(),
			};

			const result = await simulateApplyDiscount(data, session.id, "SAVE10", {
				discountController,
			});

			const res = result as { session: CheckoutSession };
			expect(res.session.discountCode).toBe("SAVE10");
			expect(res.session.discountAmount).toBe(1000);
			expect(res.session.total).toBe(4000); // 5000 - 1000
		});

		it("rejects invalid discount code", async () => {
			const session = await createTestSession(controller);

			const discountController: DiscountController = {
				validateCode: vi.fn().mockResolvedValue({
					valid: false,
					discountAmount: 0,
					freeShipping: false,
					error: "Code has expired",
				}),
				applyCode: vi.fn(),
			};

			const result = await simulateApplyDiscount(data, session.id, "EXPIRED", {
				discountController,
			});

			expect(result).toEqual({ error: "Code has expired", status: 400 });
		});

		it("applies free shipping discount", async () => {
			const session = await createTestSession(controller, {
				subtotal: 3000,
				total: 3500,
				shippingAmount: 500,
			});

			const discountController: DiscountController = {
				validateCode: vi.fn().mockResolvedValue({
					valid: true,
					discountAmount: 0,
					freeShipping: true,
				}),
				applyCode: vi.fn(),
			};

			const result = await simulateApplyDiscount(data, session.id, "FREESHIP", {
				discountController,
			});

			const res = result as { session: CheckoutSession };
			expect(res.session.shippingAmount).toBe(0);
		});

		it("returns 404 for nonexistent session", async () => {
			const result = await simulateApplyDiscount(data, "no-such-id", "CODE");
			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});

		it("blocks discount on another customer's session", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-owner",
			});

			const result = await simulateApplyDiscount(data, session.id, "CODE", {
				userId: "cust-intruder",
			});

			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});
	});

	// ── remove-discount ──────────────────────────────────────────────

	describe("remove-discount", () => {
		it("removes an applied discount and restores total", async () => {
			const session = await createTestSession(controller, {
				subtotal: 5000,
				total: 5000,
			});

			// Apply a discount first
			await controller.applyDiscount(session.id, {
				code: "SAVE10",
				discountAmount: 1000,
				freeShipping: false,
			});

			const result = await simulateRemoveDiscount(data, session.id);

			const res = result as { session: CheckoutSession };
			expect(res.session.discountCode).toBeUndefined();
			expect(res.session.discountAmount).toBe(0);
		});

		it("returns 404 for nonexistent session", async () => {
			const result = await simulateRemoveDiscount(data, "no-such-id");
			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});

		it("blocks removal on another customer's session", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-owner",
			});

			const result = await simulateRemoveDiscount(data, session.id, {
				userId: "cust-intruder",
			});

			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});

		it("succeeds when session has no discount (idempotent)", async () => {
			const session = await createTestSession(controller, {
				subtotal: 3000,
				total: 3000,
			});

			const result = await simulateRemoveDiscount(data, session.id);
			const res = result as { session: CheckoutSession };
			expect(res.session.discountAmount).toBe(0);
			expect(res.session.total).toBe(3000);
		});
	});

	// ── remove-gift-card ─────────────────────────────────────────────

	describe("remove-gift-card", () => {
		it("removes an applied gift card and restores total", async () => {
			const session = await createTestSession(controller, {
				subtotal: 4000,
				total: 4000,
			});

			await seedLegacyStoredGiftCard(data, session.id, {
				code: "GC-ABC",
				amount: 500,
			});

			const result = await simulateRemoveGiftCard(data, session.id);

			const res = result as { session: CheckoutSession };
			expect(res.session.giftCardCode).toBeUndefined();
			expect(res.session.giftCardAmount).toBe(0);
		});

		it("returns 404 for nonexistent session", async () => {
			const result = await simulateRemoveGiftCard(data, "no-such-id");
			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});

		it("blocks removal on another customer's session", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-owner",
			});

			const result = await simulateRemoveGiftCard(data, session.id, {
				userId: "cust-intruder",
			});

			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});
	});

	// ── apply-store-credit ───────────────────────────────────────────

	describe("apply-store-credit", () => {
		it("returns 401 for unauthenticated user", async () => {
			const session = await createTestSession(controller);

			const result = await simulateApplyStoreCredit(data, session.id, {});

			expect(result).toEqual({
				error: "Must be signed in to use store credits",
				status: 401,
			});
		});

		it("returns 400 when customer has no store credit balance", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-1",
			});

			const result = await simulateApplyStoreCredit(data, session.id, {
				userId: "cust-1",
				storeCreditBalance: 0,
			});

			expect(result).toEqual({
				error: "No store credit balance available",
				status: 400,
			});
		});

		it("applies store credit up to remaining total", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-1",
				subtotal: 2000,
				total: 2000,
			});

			const result = await simulateApplyStoreCredit(data, session.id, {
				userId: "cust-1",
				storeCreditBalance: 5000, // More than the order total
			});

			const res = result as { session: CheckoutSession };
			// Capped to 2000 (the remaining total)
			expect(res.session.storeCreditAmount).toBe(2000);
			expect(res.session.total).toBe(0);
		});

		it("applies partial credit when balance is less than total", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-1",
				subtotal: 5000,
				total: 5000,
			});

			const result = await simulateApplyStoreCredit(data, session.id, {
				userId: "cust-1",
				storeCreditBalance: 1000,
			});

			const res = result as { session: CheckoutSession };
			expect(res.session.storeCreditAmount).toBe(1000);
			expect(res.session.total).toBe(4000);
		});

		it("returns 404 for nonexistent session", async () => {
			const result = await simulateApplyStoreCredit(data, "no-such-id", {
				userId: "cust-1",
				storeCreditBalance: 1000,
			});
			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});

		it("blocks credit on another customer's session", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-owner",
			});

			const result = await simulateApplyStoreCredit(data, session.id, {
				userId: "cust-intruder",
				storeCreditBalance: 1000,
			});

			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});
	});

	// ── remove-store-credit ──────────────────────────────────────────

	describe("remove-store-credit", () => {
		it("removes applied store credit and restores total", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-1",
				subtotal: 3000,
				total: 3000,
			});

			// Apply store credit first
			await controller.applyStoreCredit(session.id, {
				storeCreditAmount: 500,
			});

			const result = await simulateRemoveStoreCredit(data, session.id, {
				userId: "cust-1",
			});

			const res = result as { session: CheckoutSession };
			expect(res.session.storeCreditAmount).toBe(0);
		});

		it("returns 404 for nonexistent session", async () => {
			const result = await simulateRemoveStoreCredit(data, "no-such-id", {
				userId: "cust-1",
			});
			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});

		it("blocks removal on another customer's session", async () => {
			const session = await createTestSession(controller, {
				customerId: "cust-owner",
			});

			const result = await simulateRemoveStoreCredit(data, session.id, {
				userId: "cust-intruder",
			});

			expect(result).toEqual({
				error: "Checkout session not found",
				status: 404,
			});
		});
	});
});
