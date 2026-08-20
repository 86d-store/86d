import { describe, expect, it, vi } from "vitest";
import { createOption } from "../admin/endpoints/create-option";
import { deleteOption } from "../admin/endpoints/delete-option";
import { getOption } from "../admin/endpoints/get-option";
import { listOptions } from "../admin/endpoints/list-options";
import { orderSelections } from "../admin/endpoints/order-selections";
import { updateOption } from "../admin/endpoints/update-option";
import { wrapSummary } from "../admin/endpoints/wrap-summary";
import type {
	GiftWrappingController,
	WrapOption,
	WrapSelection,
	WrapSummary,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeOption(overrides: Partial<WrapOption> = {}): WrapOption {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Gold Foil",
		priceInCents: 499,
		active: true,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeSelection(overrides: Partial<WrapSelection> = {}): WrapSelection {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		orderId: "order-1",
		orderItemId: "item-1",
		wrapOptionId: "opt-1",
		wrapOptionName: "Gold Foil",
		priceInCents: 499,
		createdAt: now,
		...overrides,
	};
}

function makeSummary(overrides: Partial<WrapSummary> = {}): WrapSummary {
	return {
		totalOptions: 0,
		activeOptions: 0,
		totalSelections: 0,
		totalRevenue: 0,
		...overrides,
	};
}

function makeController(
	overrides: Partial<GiftWrappingController> = {},
): GiftWrappingController {
	return {
		createOption: vi.fn().mockResolvedValue(makeOption()),
		updateOption: vi.fn().mockResolvedValue(null),
		getOption: vi.fn().mockResolvedValue(null),
		listOptions: vi.fn().mockResolvedValue([]),
		deleteOption: vi.fn().mockResolvedValue(false),
		selectWrapping: vi.fn().mockResolvedValue(makeSelection()),
		removeSelection: vi.fn().mockResolvedValue(false),
		getSelection: vi.fn().mockResolvedValue(null),
		getOrderSelections: vi.fn().mockResolvedValue([]),
		getOrderWrappingTotal: vi
			.fn()
			.mockResolvedValue({ selections: [], totalInCents: 0 }),
		getItemSelection: vi.fn().mockResolvedValue(null),
		getWrapSummary: vi.fn().mockResolvedValue(makeSummary()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: GiftWrappingController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { giftWrapping: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listHandler = extractHandler(listOptions);
const createHandler = extractHandler(createOption);
const summaryHandler = extractHandler(wrapSummary);
const getHandler = extractHandler(getOption);
const updateHandler = extractHandler(updateOption);
const deleteHandler = extractHandler(deleteOption);
const orderSelectionsHandler = extractHandler(orderSelections);

// ── admin GET /gift-wrapping ──────────────────────────────────────────────────

describe("admin GET /gift-wrapping", () => {
	it("returns empty list when no options exist", async () => {
		const result = (await call(listHandler)) as { options: WrapOption[] };
		expect(result.options).toHaveLength(0);
	});

	it("returns options from controller", async () => {
		const options = [makeOption({ name: "Silver Ribbon" })];
		const ctrl = makeController({
			listOptions: vi.fn().mockResolvedValue(options),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			options: WrapOption[];
		};
		expect(result.options).toHaveLength(1);
		expect(result.options[0].name).toBe("Silver Ribbon");
	});
});

// ── admin POST /gift-wrapping/create ─────────────────────────────────────────

describe("admin POST /gift-wrapping/create", () => {
	it("creates an option and returns it", async () => {
		const option = makeOption({ name: "Red Bow", priceInCents: 299 });
		const ctrl = makeController({
			createOption: vi.fn().mockResolvedValue(option),
		});
		const result = (await call(createHandler, {
			body: { name: "Red Bow", priceInCents: 299 },
			controller: ctrl,
		})) as { option: WrapOption };
		expect(result.option.name).toBe("Red Bow");
		expect(result.option.priceInCents).toBe(299);
	});

	it("calls controller with body fields", async () => {
		const ctrl = makeController();
		await call(createHandler, {
			body: { name: "Luxury Box", priceInCents: 999 },
			controller: ctrl,
		});
		expect(ctrl.createOption).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Luxury Box", priceInCents: 999 }),
		);
	});
});

// ── admin GET /gift-wrapping/summary ─────────────────────────────────────────

describe("admin GET /gift-wrapping/summary", () => {
	it("returns zero-state summary", async () => {
		const result = (await call(summaryHandler)) as { summary: WrapSummary };
		expect(result.summary.totalOptions).toBe(0);
		expect(result.summary.totalRevenue).toBe(0);
	});

	it("returns real summary from controller", async () => {
		const ctrl = makeController({
			getWrapSummary: vi.fn().mockResolvedValue(
				makeSummary({
					totalOptions: 5,
					activeOptions: 4,
					totalSelections: 120,
					totalRevenue: 35880,
				}),
			),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: WrapSummary;
		};
		expect(result.summary.totalOptions).toBe(5);
		expect(result.summary.totalRevenue).toBe(35880);
	});
});

// ── admin GET /gift-wrapping/:id ──────────────────────────────────────────────

describe("admin GET /gift-wrapping/:id", () => {
	it("returns 404 when option not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Wrap option not found");
	});

	it("returns option when found", async () => {
		const option = makeOption({ id: "opt-1", name: "Velvet Box" });
		const ctrl = makeController({
			getOption: vi.fn().mockResolvedValue(option),
		});
		const result = (await call(getHandler, {
			params: { id: "opt-1" },
			controller: ctrl,
		})) as { option: WrapOption };
		expect(result.option.id).toBe("opt-1");
		expect(result.option.name).toBe("Velvet Box");
	});
});

// ── admin POST /gift-wrapping/:id/update ─────────────────────────────────────

describe("admin POST /gift-wrapping/:id/update", () => {
	it("returns 404 when option not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { name: "New Name" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated option on success", async () => {
		const option = makeOption({ id: "opt-2", priceInCents: 799 });
		const ctrl = makeController({
			updateOption: vi.fn().mockResolvedValue(option),
		});
		const result = (await call(updateHandler, {
			params: { id: "opt-2" },
			body: { priceInCents: 799 },
			controller: ctrl,
		})) as { option: WrapOption };
		expect(result.option.priceInCents).toBe(799);
	});
});

// ── admin POST /gift-wrapping/:id/delete ─────────────────────────────────────

describe("admin POST /gift-wrapping/:id/delete", () => {
	it("returns deleted=false when option not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted=true when option deleted", async () => {
		const ctrl = makeController({
			deleteOption: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "opt-3" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ── admin GET /gift-wrapping/order/:orderId ───────────────────────────────────

describe("admin GET /gift-wrapping/order/:orderId", () => {
	it("returns empty selections and zero total for unknown order", async () => {
		const result = (await call(orderSelectionsHandler, {
			params: { orderId: "order-empty" },
		})) as { selections: WrapSelection[]; totalInCents: number };
		expect(result.selections).toHaveLength(0);
		expect(result.totalInCents).toBe(0);
	});

	it("returns selections and total for existing order", async () => {
		const selections = [makeSelection({ orderId: "order-7" })];
		const ctrl = makeController({
			getOrderWrappingTotal: vi
				.fn()
				.mockResolvedValue({ selections, totalInCents: 499 }),
		});
		const result = (await call(orderSelectionsHandler, {
			params: { orderId: "order-7" },
			controller: ctrl,
		})) as { selections: WrapSelection[]; totalInCents: number };
		expect(result.selections).toHaveLength(1);
		expect(result.totalInCents).toBe(499);
		expect(ctrl.getOrderWrappingTotal).toHaveBeenCalledWith("order-7");
	});
});
