import { describe, expect, it, vi } from "vitest";
import { assignProduct } from "../admin/endpoints/assign-product";
import { createPayout } from "../admin/endpoints/create-payout";
import { createVendor } from "../admin/endpoints/create-vendor";
import { deleteVendor } from "../admin/endpoints/delete-vendor";
import { getStats } from "../admin/endpoints/get-stats";
import { getVendor } from "../admin/endpoints/get-vendor";
import { listPayouts } from "../admin/endpoints/list-payouts";
import { listProducts } from "../admin/endpoints/list-products";
import { listVendors } from "../admin/endpoints/list-vendors";
import { payoutStats } from "../admin/endpoints/payout-stats";
import { unassignProduct } from "../admin/endpoints/unassign-product";
import { updatePayoutStatus } from "../admin/endpoints/update-payout-status";
import { updateStatus } from "../admin/endpoints/update-status";
import { updateVendor } from "../admin/endpoints/update-vendor";
import type {
	PayoutStats,
	Vendor,
	VendorController,
	VendorPayout,
	VendorProduct,
	VendorStats,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Acme Supplies",
		slug: "acme",
		email: "vendor@acme.com",
		commissionRate: 15,
		status: "active",
		joinedAt: now,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makePayout(overrides: Partial<VendorPayout> = {}): VendorPayout {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		vendorId: "v1",
		amount: 10000,
		currency: "USD",
		status: "pending",
		periodStart: now,
		periodEnd: now,
		createdAt: now,
		...overrides,
	};
}

function makeProduct(overrides: Partial<VendorProduct> = {}): VendorProduct {
	return {
		id: crypto.randomUUID(),
		vendorId: "v1",
		productId: "prod_1",
		status: "active",
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<VendorController> = {},
): VendorController {
	return {
		createVendor: vi.fn().mockResolvedValue(makeVendor()),
		getVendor: vi.fn().mockResolvedValue(null),
		getVendorBySlug: vi.fn().mockResolvedValue(null),
		updateVendor: vi.fn().mockResolvedValue(null),
		deleteVendor: vi.fn().mockResolvedValue(false),
		listVendors: vi.fn().mockResolvedValue([]),
		countVendors: vi.fn().mockResolvedValue(0),
		updateVendorStatus: vi.fn().mockResolvedValue(null),
		assignProduct: vi.fn().mockResolvedValue(makeProduct()),
		unassignProduct: vi.fn().mockResolvedValue(undefined),
		listVendorProducts: vi.fn().mockResolvedValue([]),
		countVendorProducts: vi.fn().mockResolvedValue(0),
		getProductVendor: vi.fn().mockResolvedValue(null),
		createPayout: vi.fn().mockResolvedValue(makePayout()),
		getPayout: vi.fn().mockResolvedValue(null),
		updatePayoutStatus: vi.fn().mockResolvedValue(null),
		listPayouts: vi.fn().mockResolvedValue([]),
		countPayouts: vi.fn().mockResolvedValue(0),
		getPayoutStats: vi.fn().mockResolvedValue({
			totalPayouts: 0,
			pendingAmount: 0,
			processingAmount: 0,
			completedAmount: 0,
			failedAmount: 0,
		} satisfies PayoutStats),
		getStats: vi.fn().mockResolvedValue({
			totalVendors: 0,
			activeVendors: 0,
			pendingVendors: 0,
			suspendedVendors: 0,
			totalProducts: 0,
			totalPayouts: 0,
			pendingPayoutAmount: 0,
			completedPayoutAmount: 0,
		} satisfies VendorStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: VendorController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { vendors: opts.controller ?? makeController() } },
	});
}

const listVendorsHandler = extractHandler(listVendors);
const createVendorHandler = extractHandler(createVendor);
const getVendorHandler = extractHandler(getVendor);
const updateVendorHandler = extractHandler(updateVendor);
const deleteVendorHandler = extractHandler(deleteVendor);
const updateStatusHandler = extractHandler(updateStatus);
const assignProductHandler = extractHandler(assignProduct);
const unassignProductHandler = extractHandler(unassignProduct);
const listProductsHandler = extractHandler(listProducts);
const createPayoutHandler = extractHandler(createPayout);
const updatePayoutStatusHandler = extractHandler(updatePayoutStatus);
const listPayoutsHandler = extractHandler(listPayouts);
const payoutStatsHandler = extractHandler(payoutStats);
const statsHandler = extractHandler(getStats);

describe("admin GET /vendors", () => {
	it("returns empty list", async () => {
		const result = (await call(listVendorsHandler)) as {
			vendors: Vendor[];
			total: number;
		};
		expect(result.vendors).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards status filter", async () => {
		const ctrl = makeController();
		await call(listVendorsHandler, {
			query: { status: "pending" },
			controller: ctrl,
		});
		expect(ctrl.listVendors).toHaveBeenCalledWith(
			expect.objectContaining({ status: "pending" }),
		);
	});
});

describe("admin POST /vendors/create", () => {
	it("creates vendor and returns it", async () => {
		const vendor = makeVendor({ name: "New Vendor" });
		const ctrl = makeController({
			createVendor: vi.fn().mockResolvedValue(vendor),
		});
		const result = (await call(createVendorHandler, {
			body: { name: "New Vendor", slug: "new-vendor", email: "v@new.com" },
			controller: ctrl,
		})) as { vendor: Vendor };
		expect(result.vendor.name).toBe("New Vendor");
	});
});

describe("admin GET /vendors/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(getVendorHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns vendor when found", async () => {
		const vendor = makeVendor({ id: "v1" });
		const ctrl = makeController({
			getVendor: vi.fn().mockResolvedValue(vendor),
		});
		const result = (await call(getVendorHandler, {
			params: { id: "v1" },
			controller: ctrl,
		})) as { vendor: Vendor };
		expect(result.vendor.id).toBe("v1");
	});
});

describe("admin POST /vendors/:id/update", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(updateVendorHandler, {
			params: { id: "missing" },
			body: { name: "X" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates vendor and returns it", async () => {
		const vendor = makeVendor({ name: "Updated" });
		const ctrl = makeController({
			updateVendor: vi.fn().mockResolvedValue(vendor),
		});
		const result = (await call(updateVendorHandler, {
			params: { id: vendor.id },
			body: { name: "Updated" },
			controller: ctrl,
		})) as { vendor: Vendor };
		expect(result.vendor.name).toBe("Updated");
	});
});

describe("admin DELETE /vendors/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(deleteVendorHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes vendor and returns success", async () => {
		const ctrl = makeController({
			deleteVendor: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteVendorHandler, {
			params: { id: "v1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin POST /vendors/:id/status", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(updateStatusHandler, {
			params: { id: "missing" },
			body: { status: "suspended" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates status and returns vendor", async () => {
		const vendor = makeVendor({ status: "suspended" });
		const ctrl = makeController({
			updateVendorStatus: vi.fn().mockResolvedValue(vendor),
		});
		const result = (await call(updateStatusHandler, {
			params: { id: vendor.id },
			body: { status: "suspended" },
			controller: ctrl,
		})) as { vendor: Vendor };
		expect(result.vendor.status).toBe("suspended");
	});
});

describe("admin POST /vendors/:vendorId/products/assign", () => {
	it("assigns product and returns assignment", async () => {
		const product = makeProduct({ vendorId: "v1", productId: "prod_1" });
		const ctrl = makeController({
			assignProduct: vi.fn().mockResolvedValue(product),
		});
		const result = (await call(assignProductHandler, {
			params: { vendorId: "v1" },
			body: { productId: "prod_1" },
			controller: ctrl,
		})) as { assignment: VendorProduct };
		expect(result.assignment.productId).toBe("prod_1");
	});
});

describe("admin POST /vendors/:vendorId/products/:productId/unassign", () => {
	it("returns 404 when assignment not found", async () => {
		const ctrl = makeController({
			unassignProduct: vi.fn().mockResolvedValue(false),
		});
		const result = (await call(unassignProductHandler, {
			params: { vendorId: "v1", productId: "missing" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("unassigns product and returns success", async () => {
		const ctrl = makeController({
			unassignProduct: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(unassignProductHandler, {
			params: { vendorId: "v1", productId: "prod_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin GET /vendors/:vendorId/products", () => {
	it("returns empty list when no products", async () => {
		const result = (await call(listProductsHandler, {
			params: { vendorId: "v1" },
		})) as { products: VendorProduct[]; total: number };
		expect(result.products).toHaveLength(0);
		expect(result.total).toBe(0);
	});
});

describe("admin POST /vendors/:vendorId/payouts/create", () => {
	it("creates payout and returns it", async () => {
		const payout = makePayout({ vendorId: "v1", amount: 5000 });
		const ctrl = makeController({
			createPayout: vi.fn().mockResolvedValue(payout),
		});
		const result = (await call(createPayoutHandler, {
			params: { vendorId: "v1" },
			body: {
				amount: 5000,
				currency: "USD",
				periodStart: new Date().toISOString(),
				periodEnd: new Date().toISOString(),
			},
			controller: ctrl,
		})) as { payout: VendorPayout };
		expect(result.payout.amount).toBe(5000);
	});
});

describe("admin POST /vendors/payouts/:id/status", () => {
	it("returns 404 when payout not found", async () => {
		const result = (await call(updatePayoutStatusHandler, {
			params: { id: "missing" },
			body: { status: "completed" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates payout status and returns it", async () => {
		const payout = makePayout({ status: "completed" });
		const ctrl = makeController({
			updatePayoutStatus: vi.fn().mockResolvedValue(payout),
		});
		const result = (await call(updatePayoutStatusHandler, {
			params: { id: payout.id },
			body: { status: "completed" },
			controller: ctrl,
		})) as { payout: VendorPayout };
		expect(result.payout.status).toBe("completed");
	});
});

describe("admin GET /vendors/:vendorId/payouts", () => {
	it("returns empty list", async () => {
		const result = (await call(listPayoutsHandler, {
			params: { vendorId: "v1" },
		})) as { payouts: VendorPayout[]; total: number };
		expect(result.payouts).toHaveLength(0);
	});
});

describe("admin GET /vendors/payouts/stats", () => {
	it("returns payout stats", async () => {
		const ctrl = makeController({
			getPayoutStats: vi.fn().mockResolvedValue({
				totalPayouts: 10,
				pendingAmount: 5000,
				processingAmount: 2000,
				completedAmount: 30000,
				failedAmount: 500,
			}),
		});
		const result = (await call(payoutStatsHandler, { controller: ctrl })) as {
			stats: PayoutStats;
		};
		expect(result.stats.totalPayouts).toBe(10);
	});
});

describe("admin GET /vendors/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as { stats: VendorStats };
		expect(result.stats.totalVendors).toBe(0);
	});

	it("returns real stats", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalVendors: 12,
				activeVendors: 10,
				pendingVendors: 1,
				suspendedVendors: 1,
				totalProducts: 250,
				totalPayouts: 45,
				pendingPayoutAmount: 12000,
				completedPayoutAmount: 85000,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: VendorStats;
		};
		expect(result.stats.totalVendors).toBe(12);
	});
});
