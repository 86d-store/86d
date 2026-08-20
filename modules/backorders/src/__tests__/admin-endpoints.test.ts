import { describe, expect, it, vi } from "vitest";
import { allocateStock } from "../admin/endpoints/allocate-stock";
import { backorderSummary } from "../admin/endpoints/backorder-summary";
import { bulkUpdateStatus } from "../admin/endpoints/bulk-update-status";
import { cancelBackorderAdmin } from "../admin/endpoints/cancel-backorder";
import { deletePolicy } from "../admin/endpoints/delete-policy";
import { getBackorderAdmin } from "../admin/endpoints/get-backorder";
import { getPolicy } from "../admin/endpoints/get-policy";
import { listBackorders } from "../admin/endpoints/list-backorders";
import { listPolicies } from "../admin/endpoints/list-policies";
import { setPolicy } from "../admin/endpoints/set-policy";
import { updateStatus } from "../admin/endpoints/update-status";
import type {
	Backorder,
	BackorderPolicy,
	BackorderSummary,
	BackordersController,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeBackorder(overrides: Partial<Backorder> = {}): Backorder {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		productId: "prod_1",
		productName: "Widget Pro",
		customerId: "cust_1",
		customerEmail: "cust@example.com",
		quantity: 2,
		status: "pending",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makePolicy(overrides: Partial<BackorderPolicy> = {}): BackorderPolicy {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		productId: "prod_1",
		enabled: true,
		autoConfirm: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<BackordersController> = {},
): BackordersController {
	return {
		createBackorder: vi.fn().mockResolvedValue(makeBackorder()),
		getBackorder: vi.fn().mockResolvedValue(null),
		listBackorders: vi.fn().mockResolvedValue([]),
		countByProduct: vi.fn().mockResolvedValue(0),
		updateStatus: vi.fn().mockResolvedValue(null),
		bulkUpdateStatus: vi.fn().mockResolvedValue({ updated: 0 }),
		allocateStock: vi
			.fn()
			.mockResolvedValue({ allocated: 0, backorderIds: [] }),
		cancelBackorder: vi.fn().mockResolvedValue(null),
		getCustomerBackorders: vi.fn().mockResolvedValue([]),
		setPolicy: vi.fn().mockResolvedValue(makePolicy()),
		getPolicy: vi.fn().mockResolvedValue(null),
		listPolicies: vi.fn().mockResolvedValue([]),
		deletePolicy: vi.fn().mockResolvedValue(false),
		checkEligibility: vi.fn().mockResolvedValue(null),
		getSummary: vi.fn().mockResolvedValue({
			totalPending: 0,
			totalConfirmed: 0,
			totalAllocated: 0,
			totalShipped: 0,
			totalDelivered: 0,
			totalCancelled: 0,
			topProducts: [],
		} satisfies BackorderSummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: BackordersController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { backorders: opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(listBackorders);
const summaryHandler = extractHandler(backorderSummary);
const getHandler = extractHandler(getBackorderAdmin);
const updateStatusHandler = extractHandler(updateStatus);
const cancelHandler = extractHandler(cancelBackorderAdmin);
const bulkUpdateHandler = extractHandler(bulkUpdateStatus);
const allocateHandler = extractHandler(allocateStock);
const listPoliciesHandler = extractHandler(listPolicies);
const getPolicyHandler = extractHandler(getPolicy);
const setPolicyHandler = extractHandler(setPolicy);
const deletePolicyHandler = extractHandler(deletePolicy);

describe("admin GET /backorders", () => {
	it("returns empty list", async () => {
		const result = (await call(listHandler)) as {
			backorders: Backorder[];
			total: number;
		};
		expect(result.backorders).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards status filter", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { status: "pending" },
			controller: ctrl,
		});
		expect(ctrl.listBackorders).toHaveBeenCalledWith(
			expect.objectContaining({ status: "pending" }),
		);
	});

	it("returns list of backorders", async () => {
		const backorders = [
			makeBackorder({ status: "confirmed" }),
			makeBackorder({ status: "allocated" }),
		];
		const ctrl = makeController({
			listBackorders: vi.fn().mockResolvedValue(backorders),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			backorders: Backorder[];
			total: number;
		};
		expect(result.backorders).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

describe("admin GET /backorders/summary", () => {
	it("returns zero-state summary", async () => {
		const result = (await call(summaryHandler)) as {
			summary: BackorderSummary;
		};
		expect(result.summary.totalPending).toBe(0);
		expect(result.summary.topProducts).toHaveLength(0);
	});

	it("returns real summary", async () => {
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue({
				totalPending: 10,
				totalConfirmed: 5,
				totalAllocated: 3,
				totalShipped: 8,
				totalDelivered: 20,
				totalCancelled: 2,
				topProducts: [
					{ productId: "prod_1", productName: "Widget", count: 10 },
				],
			}),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: BackorderSummary;
		};
		expect(result.summary.totalPending).toBe(10);
		expect(result.summary.totalDelivered).toBe(20);
		expect(result.summary.topProducts).toHaveLength(1);
	});
});

describe("admin GET /backorders/:id", () => {
	it("returns error when not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; backorder: null };
		expect(result.backorder).toBeNull();
		expect(result.error).toBeDefined();
	});

	it("returns backorder when found", async () => {
		const backorder = makeBackorder({ id: "bo_1" });
		const ctrl = makeController({
			getBackorder: vi.fn().mockResolvedValue(backorder),
		});
		const result = (await call(getHandler, {
			params: { id: "bo_1" },
			controller: ctrl,
		})) as { backorder: Backorder };
		expect(result.backorder.id).toBe("bo_1");
	});
});

describe("admin POST /backorders/:id/status", () => {
	it("returns error when not found", async () => {
		const result = (await call(updateStatusHandler, {
			params: { id: "missing" },
			body: { status: "confirmed" },
		})) as { error: string; backorder: null };
		expect(result.backorder).toBeNull();
		expect(result.error).toBeDefined();
	});

	it("updates status", async () => {
		const backorder = makeBackorder({ status: "confirmed" });
		const ctrl = makeController({
			updateStatus: vi.fn().mockResolvedValue(backorder),
		});
		const result = (await call(updateStatusHandler, {
			params: { id: backorder.id },
			body: { status: "confirmed" },
			controller: ctrl,
		})) as { backorder: Backorder };
		expect(result.backorder.status).toBe("confirmed");
	});

	it("forwards optional reason", async () => {
		const backorder = makeBackorder({ status: "cancelled" });
		const ctrl = makeController({
			updateStatus: vi.fn().mockResolvedValue(backorder),
		});
		await call(updateStatusHandler, {
			params: { id: backorder.id },
			body: { status: "cancelled", reason: "Out of stock" },
			controller: ctrl,
		});
		expect(ctrl.updateStatus).toHaveBeenCalledWith(
			backorder.id,
			"cancelled",
			"Out of stock",
		);
	});
});

describe("admin POST /backorders/:id/cancel", () => {
	it("returns error when not found", async () => {
		const result = (await call(cancelHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string; cancelled: false };
		expect(result.cancelled).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("cancels backorder", async () => {
		const backorder = makeBackorder({ status: "cancelled" });
		const ctrl = makeController({
			cancelBackorder: vi.fn().mockResolvedValue(backorder),
		});
		const result = (await call(cancelHandler, {
			params: { id: backorder.id },
			body: { reason: "Customer request" },
			controller: ctrl,
		})) as { cancelled: true; backorder: Backorder };
		expect(result.cancelled).toBe(true);
		expect(result.backorder.status).toBe("cancelled");
	});
});

describe("admin POST /backorders/bulk-status", () => {
	it("returns updated count", async () => {
		const ctrl = makeController({
			bulkUpdateStatus: vi.fn().mockResolvedValue({ updated: 3 }),
		});
		const result = (await call(bulkUpdateHandler, {
			body: { ids: ["bo_1", "bo_2", "bo_3"], status: "confirmed" },
			controller: ctrl,
		})) as { updated: number };
		expect(result.updated).toBe(3);
	});

	it("calls controller with ids and status", async () => {
		const ctrl = makeController();
		await call(bulkUpdateHandler, {
			body: { ids: ["bo_1", "bo_2"], status: "allocated" },
			controller: ctrl,
		});
		expect(ctrl.bulkUpdateStatus).toHaveBeenCalledWith(
			["bo_1", "bo_2"],
			"allocated",
		);
	});
});

describe("admin POST /backorders/allocate", () => {
	it("returns allocated count and backorder ids", async () => {
		const ctrl = makeController({
			allocateStock: vi
				.fn()
				.mockResolvedValue({ allocated: 2, backorderIds: ["bo_1", "bo_2"] }),
		});
		const result = (await call(allocateHandler, {
			body: { productId: "prod_1", quantity: 5 },
			controller: ctrl,
		})) as { allocated: number; backorderIds: string[] };
		expect(result.allocated).toBe(2);
		expect(result.backorderIds).toHaveLength(2);
	});

	it("calls controller with productId and quantity", async () => {
		const ctrl = makeController();
		await call(allocateHandler, {
			body: { productId: "prod_1", quantity: 10 },
			controller: ctrl,
		});
		expect(ctrl.allocateStock).toHaveBeenCalledWith("prod_1", 10);
	});
});

describe("admin GET /backorders/policies", () => {
	it("returns empty list", async () => {
		const result = (await call(listPoliciesHandler)) as {
			policies: BackorderPolicy[];
		};
		expect(result.policies).toHaveLength(0);
	});

	it("returns list of policies", async () => {
		const policies = [
			makePolicy({ productId: "prod_1" }),
			makePolicy({ productId: "prod_2" }),
		];
		const ctrl = makeController({
			listPolicies: vi.fn().mockResolvedValue(policies),
		});
		const result = (await call(listPoliciesHandler, {
			controller: ctrl,
		})) as { policies: BackorderPolicy[] };
		expect(result.policies).toHaveLength(2);
	});
});

describe("admin GET /backorders/policies/:productId", () => {
	it("returns error when not found", async () => {
		const result = (await call(getPolicyHandler, {
			params: { productId: "missing" },
		})) as { error: string; policy: null };
		expect(result.policy).toBeNull();
		expect(result.error).toBeDefined();
	});

	it("returns policy when found", async () => {
		const policy = makePolicy({ productId: "prod_1" });
		const ctrl = makeController({
			getPolicy: vi.fn().mockResolvedValue(policy),
		});
		const result = (await call(getPolicyHandler, {
			params: { productId: "prod_1" },
			controller: ctrl,
		})) as { policy: BackorderPolicy };
		expect(result.policy.productId).toBe("prod_1");
	});
});

describe("admin POST /backorders/policies/set", () => {
	it("creates a policy and returns it", async () => {
		const policy = makePolicy({ enabled: true, estimatedLeadDays: 7 });
		const ctrl = makeController({
			setPolicy: vi.fn().mockResolvedValue(policy),
		});
		const result = (await call(setPolicyHandler, {
			body: { productId: "prod_1", enabled: true, estimatedLeadDays: 7 },
			controller: ctrl,
		})) as { policy: BackorderPolicy };
		expect(result.policy.enabled).toBe(true);
		expect(result.policy.estimatedLeadDays).toBe(7);
	});

	it("calls controller with correct params", async () => {
		const ctrl = makeController();
		await call(setPolicyHandler, {
			body: {
				productId: "prod_1",
				enabled: false,
				maxQuantityPerOrder: 5,
				autoConfirm: true,
			},
			controller: ctrl,
		});
		expect(ctrl.setPolicy).toHaveBeenCalledWith(
			expect.objectContaining({
				productId: "prod_1",
				enabled: false,
				maxQuantityPerOrder: 5,
				autoConfirm: true,
			}),
		);
	});
});

describe("admin POST /backorders/policies/:productId/delete", () => {
	it("returns deleted false when not found", async () => {
		const result = (await call(deletePolicyHandler, {
			params: { productId: "missing" },
			body: {},
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted true when found", async () => {
		const ctrl = makeController({
			deletePolicy: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deletePolicyHandler, {
			params: { productId: "prod_1" },
			body: {},
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});
