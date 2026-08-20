import { describe, expect, it, vi } from "vitest";
import { createProductEndpoint } from "../admin/endpoints/create-product";
import { disableProductEndpoint } from "../admin/endpoints/disable-product";
import { getProductEndpoint } from "../admin/endpoints/get-product";
import { listOrdersEndpoint } from "../admin/endpoints/list-orders";
import { listProductsEndpoint } from "../admin/endpoints/list-products";
import { pendingShipmentsEndpoint } from "../admin/endpoints/pending-shipments";
import { shipOrderEndpoint } from "../admin/endpoints/ship-order";
import { statsEndpoint } from "../admin/endpoints/stats";
import { updateProductEndpoint } from "../admin/endpoints/update-product";
import type {
	ChannelStats,
	WishController,
	WishOrder,
	WishProduct,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeProduct(overrides: Partial<WishProduct> = {}): WishProduct {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		localProductId: "local_1",
		title: "Blue T-Shirt",
		status: "active",
		price: 1999,
		shippingPrice: 399,
		quantity: 50,
		tags: [],
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeOrder(overrides: Partial<WishOrder> = {}): WishOrder {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		wishOrderId: "wish_order_1",
		status: "pending",
		items: [],
		orderTotal: 2398,
		shippingTotal: 399,
		wishFee: 100,
		shippingAddress: { street: "123 Main St" },
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeChannelStats(overrides: Partial<ChannelStats> = {}): ChannelStats {
	return {
		totalProducts: 0,
		activeProducts: 0,
		totalOrders: 0,
		totalRevenue: 0,
		pendingShipments: 0,
		disabledProducts: 0,
		...overrides,
	};
}

function makeController(
	overrides: Partial<WishController> = {},
): WishController {
	return {
		createProduct: vi.fn().mockResolvedValue(makeProduct()),
		updateProduct: vi.fn().mockResolvedValue(null),
		disableProduct: vi.fn().mockResolvedValue(null),
		getProduct: vi.fn().mockResolvedValue(null),
		getProductByLocalId: vi.fn().mockResolvedValue(null),
		listProducts: vi.fn().mockResolvedValue([]),
		receiveOrder: vi.fn().mockResolvedValue(makeOrder()),
		getOrder: vi.fn().mockResolvedValue(null),
		shipOrder: vi.fn().mockResolvedValue(null),
		listOrders: vi.fn().mockResolvedValue([]),
		getChannelStats: vi.fn().mockResolvedValue(makeChannelStats()),
		getPendingShipments: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: WishController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { wish: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const createProductHandler = extractHandler(createProductEndpoint);
const disableProductHandler = extractHandler(disableProductEndpoint);
const getProductHandler = extractHandler(getProductEndpoint);
const listOrdersHandler = extractHandler(listOrdersEndpoint);
const listProductsHandler = extractHandler(listProductsEndpoint);
const pendingShipmentsHandler = extractHandler(pendingShipmentsEndpoint);
const shipOrderHandler = extractHandler(shipOrderEndpoint);
const statsHandler = extractHandler(statsEndpoint);
const updateProductHandler = extractHandler(updateProductEndpoint);

// ── admin POST /wish/products/create ──────────────────────────────────────────

describe("admin POST /wish/products/create", () => {
	it("creates a product and returns it", async () => {
		const product = makeProduct({
			localProductId: "local_42",
			title: "Red Hoodie",
		});
		const ctrl = makeController({
			createProduct: vi.fn().mockResolvedValue(product),
		});
		const result = (await call(createProductHandler, {
			body: {
				localProductId: "local_42",
				title: "Red Hoodie",
				price: 2999,
				shippingPrice: 499,
				quantity: 20,
			},
			controller: ctrl,
		})) as { product: WishProduct };
		expect(result.product.localProductId).toBe("local_42");
		expect(result.product.title).toBe("Red Hoodie");
		expect(ctrl.createProduct).toHaveBeenCalledWith(
			expect.objectContaining({
				localProductId: "local_42",
				title: "Red Hoodie",
				price: 2999,
				shippingPrice: 499,
			}),
		);
	});

	it("forwards optional fields to controller", async () => {
		const ctrl = makeController();
		await call(createProductHandler, {
			body: {
				localProductId: "local_99",
				title: "Hat",
				price: 999,
				shippingPrice: 299,
				quantity: 10,
				parentSku: "SKU-PARENT",
				tags: ["accessories", "headwear"],
			},
			controller: ctrl,
		});
		expect(ctrl.createProduct).toHaveBeenCalledWith(
			expect.objectContaining({
				parentSku: "SKU-PARENT",
				tags: ["accessories", "headwear"],
			}),
		);
	});
});

// ── admin PUT /wish/products/:id/disable ──────────────────────────────────────

describe("admin PUT /wish/products/:id/disable", () => {
	it("returns null product when product not found", async () => {
		const result = (await call(disableProductHandler, {
			params: { id: "missing" },
		})) as { product: WishProduct | null };
		expect(result.product).toBeNull();
	});

	it("returns disabled product on success", async () => {
		const product = makeProduct({ id: "prod_5", status: "disabled" });
		const ctrl = makeController({
			disableProduct: vi.fn().mockResolvedValue(product),
		});
		const result = (await call(disableProductHandler, {
			params: { id: "prod_5" },
			controller: ctrl,
		})) as { product: WishProduct };
		expect(result.product.status).toBe("disabled");
		expect(ctrl.disableProduct).toHaveBeenCalledWith("prod_5");
	});
});

// ── admin GET /wish/products/:id ──────────────────────────────────────────────

describe("admin GET /wish/products/:id", () => {
	it("returns null product when not found", async () => {
		const result = (await call(getProductHandler, {
			params: { id: "nonexistent" },
		})) as { product: WishProduct | null };
		expect(result.product).toBeNull();
	});

	it("returns product when found", async () => {
		const product = makeProduct({ id: "prod_7" });
		const ctrl = makeController({
			getProduct: vi.fn().mockResolvedValue(product),
		});
		const result = (await call(getProductHandler, {
			params: { id: "prod_7" },
			controller: ctrl,
		})) as { product: WishProduct };
		expect(result.product.id).toBe("prod_7");
		expect(ctrl.getProduct).toHaveBeenCalledWith("prod_7");
	});
});

// ── admin GET /wish/orders ────────────────────────────────────────────────────

describe("admin GET /wish/orders", () => {
	it("returns empty orders list and zero total", async () => {
		const result = (await call(listOrdersHandler)) as {
			orders: WishOrder[];
			total: number;
		};
		expect(result.orders).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns orders from controller", async () => {
		const orders = [makeOrder(), makeOrder()];
		const ctrl = makeController({
			listOrders: vi.fn().mockResolvedValue(orders),
		});
		const result = (await call(listOrdersHandler, {
			controller: ctrl,
		})) as { orders: WishOrder[]; total: number };
		expect(result.orders).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("passes status filter to controller", async () => {
		const ctrl = makeController();
		await call(listOrdersHandler, {
			query: { status: "shipped" },
			controller: ctrl,
		});
		expect(ctrl.listOrders).toHaveBeenCalledWith(
			expect.objectContaining({ status: "shipped" }),
		);
	});
});

// ── admin GET /wish/products ──────────────────────────────────────────────────

describe("admin GET /wish/products", () => {
	it("returns empty products list and zero total", async () => {
		const result = (await call(listProductsHandler)) as {
			products: WishProduct[];
			total: number;
		};
		expect(result.products).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns products from controller", async () => {
		const products = [makeProduct(), makeProduct(), makeProduct()];
		const ctrl = makeController({
			listProducts: vi.fn().mockResolvedValue(products),
		});
		const result = (await call(listProductsHandler, {
			controller: ctrl,
		})) as { products: WishProduct[]; total: number };
		expect(result.products).toHaveLength(3);
		expect(result.total).toBe(3);
	});

	it("passes status filter to controller", async () => {
		const ctrl = makeController();
		await call(listProductsHandler, {
			query: { status: "active" },
			controller: ctrl,
		});
		expect(ctrl.listProducts).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});
});

// ── admin GET /wish/orders/pending ────────────────────────────────────────────

describe("admin GET /wish/orders/pending", () => {
	it("returns empty list when no pending shipments", async () => {
		const result = (await call(pendingShipmentsHandler)) as {
			orders: WishOrder[];
		};
		expect(result.orders).toHaveLength(0);
	});

	it("returns pending shipment orders from controller", async () => {
		const orders = [
			makeOrder({ status: "approved" }),
			makeOrder({ status: "approved" }),
		];
		const ctrl = makeController({
			getPendingShipments: vi.fn().mockResolvedValue(orders),
		});
		const result = (await call(pendingShipmentsHandler, {
			controller: ctrl,
		})) as { orders: WishOrder[] };
		expect(result.orders).toHaveLength(2);
		expect(ctrl.getPendingShipments).toHaveBeenCalled();
	});
});

// ── admin PUT /wish/orders/:id/ship ───────────────────────────────────────────

describe("admin PUT /wish/orders/:id/ship", () => {
	it("returns null order when not found", async () => {
		const result = (await call(shipOrderHandler, {
			params: { id: "missing" },
			body: { trackingNumber: "TRK123", carrier: "UPS" },
		})) as { order: WishOrder | null };
		expect(result.order).toBeNull();
	});

	it("returns shipped order on success", async () => {
		const order = makeOrder({
			id: "order_5",
			status: "shipped",
			trackingNumber: "TRK999",
			carrier: "FedEx",
		});
		const ctrl = makeController({
			shipOrder: vi.fn().mockResolvedValue(order),
		});
		const result = (await call(shipOrderHandler, {
			params: { id: "order_5" },
			body: { trackingNumber: "TRK999", carrier: "FedEx" },
			controller: ctrl,
		})) as { order: WishOrder };
		expect(result.order.status).toBe("shipped");
		expect(result.order.trackingNumber).toBe("TRK999");
		expect(ctrl.shipOrder).toHaveBeenCalledWith("order_5", "TRK999", "FedEx");
	});
});

// ── admin GET /wish/stats ─────────────────────────────────────────────────────

describe("admin GET /wish/stats", () => {
	it("returns channel stats from controller", async () => {
		const stats = makeChannelStats({
			totalProducts: 50,
			activeProducts: 42,
			totalOrders: 120,
			totalRevenue: 250000,
			pendingShipments: 8,
			disabledProducts: 5,
		});
		const ctrl = makeController({
			getChannelStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: ChannelStats };
		expect(result.stats.totalProducts).toBe(50);
		expect(result.stats.activeProducts).toBe(42);
		expect(result.stats.totalOrders).toBe(120);
		expect(result.stats.pendingShipments).toBe(8);
	});

	it("returns zero-state stats when empty", async () => {
		const result = (await call(statsHandler)) as { stats: ChannelStats };
		expect(result.stats.totalProducts).toBe(0);
		expect(result.stats.totalRevenue).toBe(0);
	});
});

// ── admin PUT /wish/products/:id/update ───────────────────────────────────────

describe("admin PUT /wish/products/:id/update", () => {
	it("returns null product when not found", async () => {
		const result = (await call(updateProductHandler, {
			params: { id: "missing" },
			body: { title: "New Title" },
		})) as { product: WishProduct | null };
		expect(result.product).toBeNull();
	});

	it("returns updated product on success", async () => {
		const product = makeProduct({ id: "prod_9", title: "Updated Title" });
		const ctrl = makeController({
			updateProduct: vi.fn().mockResolvedValue(product),
		});
		const result = (await call(updateProductHandler, {
			params: { id: "prod_9" },
			body: { title: "Updated Title" },
			controller: ctrl,
		})) as { product: WishProduct };
		expect(result.product.title).toBe("Updated Title");
		expect(ctrl.updateProduct).toHaveBeenCalledWith(
			"prod_9",
			expect.objectContaining({ title: "Updated Title" }),
		);
	});

	it("forwards status update to controller", async () => {
		const ctrl = makeController({
			updateProduct: vi.fn().mockResolvedValue(makeProduct()),
		});
		await call(updateProductHandler, {
			params: { id: "prod_10" },
			body: { status: "disabled" },
			controller: ctrl,
		});
		expect(ctrl.updateProduct).toHaveBeenCalledWith(
			"prod_10",
			expect.objectContaining({ status: "disabled" }),
		);
	});
});
