import { describe, expect, it, vi } from "vitest";
import { customerItems } from "../admin/endpoints/customer-items";
import { deleteItem } from "../admin/endpoints/delete-item";
import { frequentProducts } from "../admin/endpoints/frequent-products";
import { listAllItems } from "../admin/endpoints/list-items";
import type {
	ComparisonController,
	ComparisonItem,
	FrequentlyCompared,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeItem(overrides: Partial<ComparisonItem> = {}): ComparisonItem {
	return {
		id: crypto.randomUUID(),
		productId: "prod-1",
		productName: "Widget",
		productSlug: "widget",
		addedAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<ComparisonController> = {},
): ComparisonController {
	return {
		addProduct: vi.fn().mockResolvedValue(makeItem()),
		removeProduct: vi.fn().mockResolvedValue(false),
		getComparison: vi.fn().mockResolvedValue([]),
		clearComparison: vi.fn().mockResolvedValue(0),
		mergeComparison: vi.fn().mockResolvedValue(0),
		deleteItem: vi.fn().mockResolvedValue(false),
		listAll: vi.fn().mockResolvedValue([]),
		countItems: vi.fn().mockResolvedValue(0),
		getFrequentlyCompared: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: ComparisonController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { comparisons: opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(listAllItems);
const customerHandler = extractHandler(customerItems);
const deleteHandler = extractHandler(deleteItem);
const frequentHandler = extractHandler(frequentProducts);

describe("admin GET /comparisons", () => {
	it("returns empty items and zero total", async () => {
		const result = (await call(listHandler)) as {
			items: ComparisonItem[];
			total: number;
		};
		expect(result.items).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards productId filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { productId: "p1" }, controller: ctrl });
		expect(ctrl.listAll).toHaveBeenCalledWith(
			expect.objectContaining({ productId: "p1" }),
		);
	});
});

describe("admin GET /comparisons/customer/:id", () => {
	it("returns items and total for customer", async () => {
		const item = makeItem({ customerId: "cust-1" });
		const ctrl = makeController({
			listAll: vi.fn().mockResolvedValue([item]),
			countItems: vi.fn().mockResolvedValue(1),
		});
		const result = (await call(customerHandler, {
			params: { id: "cust-1" },
			controller: ctrl,
		})) as { items: ComparisonItem[]; total: number };
		expect(result.items).toHaveLength(1);
		expect(result.total).toBe(1);
	});

	it("calls countItems with customerId param", async () => {
		const ctrl = makeController();
		await call(customerHandler, {
			params: { id: "cust-99" },
			controller: ctrl,
		});
		expect(ctrl.countItems).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cust-99" }),
		);
	});
});

describe("admin DELETE /comparisons/:id/delete", () => {
	it("returns 404 when item not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns success when item is deleted", async () => {
		const ctrl = makeController({
			deleteItem: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "ci-1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin GET /comparisons/frequent", () => {
	it("returns empty products list", async () => {
		const result = (await call(frequentHandler)) as {
			products: FrequentlyCompared[];
		};
		expect(result.products).toHaveLength(0);
	});

	it("forwards take to controller", async () => {
		const ctrl = makeController();
		await call(frequentHandler, { query: { take: "5" }, controller: ctrl });
		expect(ctrl.getFrequentlyCompared).toHaveBeenCalledWith(
			expect.objectContaining({ take: 5 }),
		);
	});
});
