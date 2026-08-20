import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteCart } from "../admin/endpoints/delete-cart";
import { getCartDetails } from "../admin/endpoints/get-cart-details";
import { listAbandonedCarts } from "../admin/endpoints/list-abandoned";
import { listCarts } from "../admin/endpoints/list-carts";
import { getRecoveryStats } from "../admin/endpoints/recovery-stats";
import { sendRecoveryEmail } from "../admin/endpoints/send-recovery";
import type { Cart, CartItem } from "../service";

// ── Module-level mock for createCartControllers ───────────────────────────────
// Use vi.hoisted so these are initialized before vi.mock factory runs.

const {
	mockGetAbandonedCarts,
	mockGetRecoveryStats,
	mockMarkRecoveryEmailSent,
} = vi.hoisted(() => ({
	mockGetAbandonedCarts: vi.fn().mockResolvedValue([]),
	mockGetRecoveryStats: vi.fn().mockResolvedValue({
		totalAbandoned: 0,
		recoverySent: 0,
		recovered: 0,
	}),
	mockMarkRecoveryEmailSent: vi.fn().mockResolvedValue(null),
}));

vi.mock("../service-impl", () => ({
	createCartControllers: vi.fn().mockReturnValue({
		getAbandonedCarts: mockGetAbandonedCarts,
		getRecoveryStats: mockGetRecoveryStats,
		markRecoveryEmailSent: mockMarkRecoveryEmailSent,
	}),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeData(overrides: Record<string, unknown> = {}) {
	return {
		get: vi.fn().mockResolvedValue(null),
		findMany: vi.fn().mockResolvedValue([]),
		create: vi.fn().mockResolvedValue(null),
		update: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		data?: ReturnType<typeof makeData>;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { data: opts.data ?? makeData() },
	});
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCart(overrides: Partial<Cart> = {}): Cart {
	const now = new Date();
	return {
		id: "cart_1",
		customerId: "cust_1",
		status: "active",
		expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
	const now = new Date();
	return {
		id: "item_1",
		cartId: "cart_1",
		productId: "prod_1",
		quantity: 2,
		price: 1500,
		productName: "Widget",
		productSlug: "widget",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listCartsHandler = extractHandler(listCarts);
const getCartDetailsHandler = extractHandler(getCartDetails);
const deleteCartHandler = extractHandler(deleteCart);
const listAbandonedCartsHandler = extractHandler(listAbandonedCarts);
const getRecoveryStatsHandler = extractHandler(getRecoveryStats);
const sendRecoveryEmailHandler = extractHandler(sendRecoveryEmail);

// ── listCarts ─────────────────────────────────────────────────────────────────

describe("admin GET /carts", () => {
	it("returns empty list when no carts exist", async () => {
		const result = (await call(listCartsHandler)) as {
			carts: Cart[];
			page: number;
			limit: number;
			total: number;
		};

		expect(result.carts).toHaveLength(0);
		expect(result.page).toBe(1);
		expect(result.limit).toBe(20);
		expect(result.total).toBe(0);
	});

	it("filters by customerId and status and respects limit", async () => {
		const cart = makeCart({ status: "abandoned", customerId: "cust_99" });
		const data = makeData({
			findMany: vi.fn().mockResolvedValue([cart]),
		});

		const result = (await call(listCartsHandler, {
			query: {
				customerId: "cust_99",
				status: "abandoned",
				page: "1",
				limit: "10",
			},
			data,
		})) as { carts: Cart[]; page: number; limit: number; total: number };

		expect(result.carts).toHaveLength(1);
		expect(result.carts[0].customerId).toBe("cust_99");
		expect(result.carts[0].status).toBe("abandoned");
		expect(result.limit).toBe(10);

		const findMany = data.findMany as ReturnType<typeof vi.fn>;
		const [table, opts] = findMany.mock.calls[0] as [
			string,
			{ where: Record<string, unknown>; take: number; skip: number },
		];
		expect(table).toBe("cart");
		expect(opts.where).toMatchObject({
			customerId: "cust_99",
			status: "abandoned",
		});
	});
});

// ── getCartDetails ────────────────────────────────────────────────────────────

describe("admin GET /carts/:id", () => {
	it("returns 404 when cart does not exist", async () => {
		const result = (await call(getCartDetailsHandler, {
			params: { id: "cart_missing" },
		})) as { error: string; status: number };

		expect(result).toEqual({ error: "Cart not found", status: 404 });
	});

	it("returns cart with items, itemCount, and subtotal", async () => {
		const cart = makeCart({ id: "cart_abc" });
		const items = [
			makeCartItem({
				id: "item_1",
				cartId: "cart_abc",
				price: 2000,
				quantity: 3,
			}),
			makeCartItem({
				id: "item_2",
				cartId: "cart_abc",
				price: 1000,
				quantity: 1,
			}),
		];
		const data = makeData({
			get: vi.fn().mockResolvedValue(cart),
			findMany: vi.fn().mockResolvedValue(items),
		});

		const result = (await call(getCartDetailsHandler, {
			params: { id: "cart_abc" },
			data,
		})) as {
			cart: Cart;
			items: CartItem[];
			itemCount: number;
			subtotal: number;
		};

		expect(result.cart.id).toBe("cart_abc");
		expect(result.items).toHaveLength(2);
		expect(result.itemCount).toBe(2);
		expect(result.subtotal).toBe(2000 * 3 + 1000 * 1); // 7000
	});
});

// ── deleteCart ────────────────────────────────────────────────────────────────

describe("admin DELETE /carts/:id", () => {
	it("deletes all items and the cart, returning success", async () => {
		const items = [
			makeCartItem({ id: "item_a", cartId: "cart_1" }),
			makeCartItem({ id: "item_b", cartId: "cart_1" }),
		];
		const data = makeData({
			findMany: vi.fn().mockResolvedValue(items),
		});

		const result = (await call(deleteCartHandler, {
			params: { id: "cart_1" },
			data,
		})) as { success: boolean; message: string };

		expect(result.success).toBe(true);
		expect(result.message).toContain("cart_1");

		const deleteFn = data.delete as ReturnType<typeof vi.fn>;
		expect(deleteFn).toHaveBeenCalledWith("cartItem", "item_a");
		expect(deleteFn).toHaveBeenCalledWith("cartItem", "item_b");
		expect(deleteFn).toHaveBeenCalledWith("cart", "cart_1");
	});

	it("deletes cart with no items and calls delete exactly once", async () => {
		const data = makeData({
			findMany: vi.fn().mockResolvedValue([]),
		});

		const result = (await call(deleteCartHandler, {
			params: { id: "cart_empty" },
			data,
		})) as { success: boolean; message: string };

		expect(result.success).toBe(true);
		const deleteFn = data.delete as ReturnType<typeof vi.fn>;
		expect(deleteFn).toHaveBeenCalledTimes(1);
		expect(deleteFn).toHaveBeenCalledWith("cart", "cart_empty");
	});
});

// ── listAbandonedCarts ────────────────────────────────────────────────────────

describe("admin GET /carts/abandoned", () => {
	beforeEach(() => {
		mockGetAbandonedCarts.mockResolvedValue([]);
	});

	it("returns empty list when no abandoned carts exist", async () => {
		const result = (await call(listAbandonedCartsHandler)) as {
			carts: unknown[];
			page: number;
			limit: number;
			total: number;
		};

		expect(result.carts).toHaveLength(0);
		expect(result.page).toBe(1);
		expect(result.total).toBe(0);
	});

	it("enriches carts with items, itemCount, subtotal, and recovery metadata", async () => {
		const cart = makeCart({
			id: "cart_ab",
			status: "abandoned",
			metadata: {
				recoveryEmailCount: 1,
				recoveryEmailSentAt: "2026-01-01T00:00:00.000Z",
			},
		});
		mockGetAbandonedCarts.mockResolvedValue([cart]);

		const items = [
			makeCartItem({ cartId: "cart_ab", price: 500, quantity: 4 }),
		];
		const data = makeData({
			findMany: vi.fn().mockResolvedValue(items),
		});

		const result = (await call(listAbandonedCartsHandler, { data })) as {
			carts: Array<{
				id: string;
				items: CartItem[];
				itemCount: number;
				subtotal: number;
				recoveryEmailCount: number;
				recoveryEmailSentAt: unknown;
			}>;
		};

		expect(result.carts).toHaveLength(1);
		const enriched = result.carts[0];
		expect(enriched.itemCount).toBe(1);
		expect(enriched.subtotal).toBe(500 * 4); // 2000
		expect(enriched.recoveryEmailCount).toBe(1);
		expect(enriched.recoveryEmailSentAt).toBe("2026-01-01T00:00:00.000Z");
	});
});

// ── getRecoveryStats ──────────────────────────────────────────────────────────

describe("admin GET /carts/recovery-stats", () => {
	beforeEach(() => {
		mockGetRecoveryStats.mockResolvedValue({
			totalAbandoned: 0,
			recoverySent: 0,
			recovered: 0,
		});
	});

	it("returns zero recoveryRate when recoverySent is 0", async () => {
		mockGetRecoveryStats.mockResolvedValue({
			totalAbandoned: 5,
			recoverySent: 0,
			recovered: 0,
		});

		const result = (await call(getRecoveryStatsHandler)) as {
			totalAbandoned: number;
			recoverySent: number;
			recovered: number;
			recoveryRate: number;
		};

		expect(result.totalAbandoned).toBe(5);
		expect(result.recoverySent).toBe(0);
		expect(result.recoveryRate).toBe(0);
	});

	it("calculates recoveryRate as percentage of recovered over recoverySent", async () => {
		mockGetRecoveryStats.mockResolvedValue({
			totalAbandoned: 10,
			recoverySent: 8,
			recovered: 2,
		});

		const result = (await call(getRecoveryStatsHandler)) as {
			totalAbandoned: number;
			recoverySent: number;
			recovered: number;
			recoveryRate: number;
		};

		expect(result.recoveryRate).toBe(Math.round((2 / 8) * 100)); // 25
	});
});

// ── sendRecoveryEmail ─────────────────────────────────────────────────────────

describe("admin POST /carts/:id/send-recovery", () => {
	const validBody = {
		email: "customer@example.com",
		customerName: "Jane Doe",
		recoveryUrl: "https://mystore.com/cart/recover/cart_1",
		storeName: "Test Store",
	};

	beforeEach(() => {
		mockMarkRecoveryEmailSent.mockResolvedValue(makeCart({ id: "cart_1" }));
	});

	it("returns 404 when cart does not exist", async () => {
		const data = makeData({ get: vi.fn().mockResolvedValue(null) });

		const result = (await call(sendRecoveryEmailHandler, {
			params: { id: "cart_missing" },
			body: validBody,
			data,
		})) as { error: string; status: number };

		expect(result).toEqual({ error: "Cart not found", status: 404 });
	});

	it("returns 400 when cart has no items", async () => {
		const cart = makeCart({ id: "cart_1" });
		const data = makeData({
			get: vi.fn().mockResolvedValue(cart),
			findMany: vi.fn().mockResolvedValue([]),
		});

		const result = (await call(sendRecoveryEmailHandler, {
			params: { id: "cart_1" },
			body: validBody,
			data,
		})) as { error: string; status: number };

		expect(result).toEqual({ error: "Cart has no items", status: 400 });
	});

	it("returns success with emailPayload when cart has items", async () => {
		const cart = makeCart({ id: "cart_1" });
		const items = [
			makeCartItem({
				id: "item_x",
				cartId: "cart_1",
				price: 3000,
				quantity: 2,
				productName: "Gadget",
				productSlug: "gadget",
				productImage: "https://img.example.com/gadget.jpg",
				variantName: "Blue",
			}),
		];
		const data = makeData({
			get: vi.fn().mockResolvedValue(cart),
			findMany: vi.fn().mockResolvedValue(items),
		});

		const result = (await call(sendRecoveryEmailHandler, {
			params: { id: "cart_1" },
			body: validBody,
			data,
		})) as {
			success: boolean;
			emailPayload: {
				to: string;
				customerName: string;
				subtotal: number;
				storeName: string;
				items: Array<{ name: string; quantity: number; price: number }>;
			};
		};

		expect(result.success).toBe(true);
		expect(result.emailPayload.to).toBe("customer@example.com");
		expect(result.emailPayload.customerName).toBe("Jane Doe");
		expect(result.emailPayload.subtotal).toBe(3000 * 2); // 6000
		expect(result.emailPayload.storeName).toBe("Test Store");
		expect(result.emailPayload.items).toHaveLength(1);
		expect(result.emailPayload.items[0]).toMatchObject({
			name: "Gadget",
			quantity: 2,
			price: 3000,
		});
		expect(mockMarkRecoveryEmailSent).toHaveBeenCalledWith("cart_1");
	});
});
