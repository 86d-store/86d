import { describe, expect, it, vi } from "vitest";
import { bulkSetEntries } from "../admin/endpoints/bulk-set-entries";
import { createPriceList } from "../admin/endpoints/create-price-list";
import { deletePriceList } from "../admin/endpoints/delete-price-list";
import { getPriceList } from "../admin/endpoints/get-price-list";
import { getStats } from "../admin/endpoints/get-stats";
import { listEntries } from "../admin/endpoints/list-entries";
import { listPriceLists } from "../admin/endpoints/list-price-lists";
import { removeEntry } from "../admin/endpoints/remove-entry";
import { setEntry } from "../admin/endpoints/set-entry";
import { updatePriceList } from "../admin/endpoints/update-price-list";
import type {
	PriceEntry,
	PriceList,
	PriceListController,
	PriceListStats,
	PriceListStatus,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makePriceList(overrides: Partial<PriceList> = {}): PriceList {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Wholesale",
		slug: "wholesale",
		priority: 0,
		status: "active" satisfies PriceListStatus,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeEntry(overrides: Partial<PriceEntry> = {}): PriceEntry {
	return {
		id: crypto.randomUUID(),
		priceListId: "pl_1",
		productId: "prod_1",
		price: 900,
		createdAt: new Date(),
		...overrides,
	};
}

function makeStats(overrides: Partial<PriceListStats> = {}): PriceListStats {
	return {
		totalPriceLists: 0,
		activePriceLists: 0,
		scheduledPriceLists: 0,
		inactivePriceLists: 0,
		totalEntries: 0,
		priceListsWithEntries: 0,
		...overrides,
	};
}

function makeController(
	overrides: Partial<PriceListController> = {},
): PriceListController {
	return {
		createPriceList: vi.fn().mockResolvedValue(makePriceList()),
		getPriceList: vi.fn().mockResolvedValue(null),
		getPriceListBySlug: vi.fn().mockResolvedValue(null),
		updatePriceList: vi.fn().mockResolvedValue(null),
		deletePriceList: vi.fn().mockResolvedValue(false),
		listPriceLists: vi.fn().mockResolvedValue([]),
		countPriceLists: vi.fn().mockResolvedValue(0),
		setPrice: vi.fn().mockResolvedValue(makeEntry()),
		getPrice: vi.fn().mockResolvedValue(null),
		removePrice: vi.fn().mockResolvedValue(false),
		listPrices: vi.fn().mockResolvedValue([]),
		countPrices: vi.fn().mockResolvedValue(0),
		bulkSetPrices: vi.fn().mockResolvedValue([]),
		resolvePrice: vi.fn().mockResolvedValue(null),
		resolvePrices: vi.fn().mockResolvedValue({}),
		getStats: vi.fn().mockResolvedValue(makeStats()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: PriceListController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { priceLists: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const bulkSetEntriesHandler = extractHandler(bulkSetEntries);
const createPriceListHandler = extractHandler(createPriceList);
const deletePriceListHandler = extractHandler(deletePriceList);
const getPriceListHandler = extractHandler(getPriceList);
const getStatsHandler = extractHandler(getStats);
const listEntriesHandler = extractHandler(listEntries);
const listPriceListsHandler = extractHandler(listPriceLists);
const removeEntryHandler = extractHandler(removeEntry);
const setEntryHandler = extractHandler(setEntry);
const updatePriceListHandler = extractHandler(updatePriceList);

// ── listPriceLists ────────────────────────────────────────────────────────────

describe("admin GET /price-lists", () => {
	it("returns empty list when no price lists exist", async () => {
		const result = (await call(listPriceListsHandler)) as {
			priceLists: PriceList[];
			total: number;
		};
		expect(result.priceLists).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns price lists and total from controller", async () => {
		const lists = [makePriceList(), makePriceList()];
		const ctrl = makeController({
			listPriceLists: vi.fn().mockResolvedValue(lists),
			countPriceLists: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(listPriceListsHandler, {
			controller: ctrl,
		})) as { priceLists: PriceList[]; total: number };
		expect(result.priceLists).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listPriceListsHandler, {
			query: { status: "active" },
			controller: ctrl,
		});
		expect(ctrl.listPriceLists).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
		expect(ctrl.countPriceLists).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});

	it("forwards customerGroupId filter to controller", async () => {
		const ctrl = makeController();
		await call(listPriceListsHandler, {
			query: { customerGroupId: "grp_1" },
			controller: ctrl,
		});
		expect(ctrl.listPriceLists).toHaveBeenCalledWith(
			expect.objectContaining({ customerGroupId: "grp_1" }),
		);
	});

	it("uses default take=50 and skip=0", async () => {
		const ctrl = makeController();
		await call(listPriceListsHandler, { controller: ctrl });
		expect(ctrl.listPriceLists).toHaveBeenCalledWith(
			expect.objectContaining({ take: 50, skip: 0 }),
		);
	});
});

// ── createPriceList ───────────────────────────────────────────────────────────

describe("admin POST /price-lists/create", () => {
	it("returns 400 when slug already exists", async () => {
		const existing = makePriceList({ slug: "wholesale" });
		const ctrl = makeController({
			getPriceListBySlug: vi.fn().mockResolvedValue(existing),
		});
		const result = (await call(createPriceListHandler, {
			body: { name: "Wholesale", slug: "wholesale" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/already exists/i);
	});

	it("creates price list when slug is unique", async () => {
		const pl = makePriceList({ name: "VIP Prices", slug: "vip" });
		const ctrl = makeController({
			getPriceListBySlug: vi.fn().mockResolvedValue(null),
			createPriceList: vi.fn().mockResolvedValue(pl),
		});
		const result = (await call(createPriceListHandler, {
			body: { name: "VIP Prices", slug: "vip" },
			controller: ctrl,
		})) as { priceList: PriceList };
		expect(result.priceList.name).toBe("VIP Prices");
		expect(result.priceList.slug).toBe("vip");
		expect(ctrl.createPriceList).toHaveBeenCalledWith(
			expect.objectContaining({ name: "VIP Prices", slug: "vip" }),
		);
	});

	it("passes optional fields when provided", async () => {
		const ctrl = makeController({
			getPriceListBySlug: vi.fn().mockResolvedValue(null),
		});
		await call(createPriceListHandler, {
			body: {
				name: "Seasonal",
				slug: "seasonal",
				currency: "EUR",
				priority: 5,
				status: "scheduled",
				customerGroupId: "grp_2",
			},
			controller: ctrl,
		});
		expect(ctrl.createPriceList).toHaveBeenCalledWith(
			expect.objectContaining({
				currency: "EUR",
				priority: 5,
				status: "scheduled",
				customerGroupId: "grp_2",
			}),
		);
	});
});

// ── getPriceList ──────────────────────────────────────────────────────────────

describe("admin GET /price-lists/:id", () => {
	it("returns 404 when price list not found", async () => {
		const result = (await call(getPriceListHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Price list not found");
	});

	it("returns price list with entries and entryCount", async () => {
		const pl = makePriceList({ id: "pl_1" });
		const entries = [makeEntry({ priceListId: "pl_1" })];
		const ctrl = makeController({
			getPriceList: vi.fn().mockResolvedValue(pl),
			listPrices: vi.fn().mockResolvedValue(entries),
			countPrices: vi.fn().mockResolvedValue(1),
		});
		const result = (await call(getPriceListHandler, {
			params: { id: "pl_1" },
			controller: ctrl,
		})) as { priceList: PriceList; entries: PriceEntry[]; entryCount: number };
		expect(result.priceList.id).toBe("pl_1");
		expect(result.entries).toHaveLength(1);
		expect(result.entryCount).toBe(1);
		expect(ctrl.listPrices).toHaveBeenCalledWith("pl_1");
		expect(ctrl.countPrices).toHaveBeenCalledWith("pl_1");
	});

	it("returns empty entries when price list has no entries", async () => {
		const pl = makePriceList({ id: "pl_2" });
		const ctrl = makeController({
			getPriceList: vi.fn().mockResolvedValue(pl),
			listPrices: vi.fn().mockResolvedValue([]),
			countPrices: vi.fn().mockResolvedValue(0),
		});
		const result = (await call(getPriceListHandler, {
			params: { id: "pl_2" },
			controller: ctrl,
		})) as { priceList: PriceList; entries: PriceEntry[]; entryCount: number };
		expect(result.entries).toHaveLength(0);
		expect(result.entryCount).toBe(0);
	});
});

// ── updatePriceList ───────────────────────────────────────────────────────────

describe("admin PUT /price-lists/:id/update", () => {
	it("returns 404 when price list not found", async () => {
		const result = (await call(updatePriceListHandler, {
			params: { id: "missing" },
			body: { name: "New Name" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Price list not found");
	});

	it("returns 400 when new slug conflicts with another price list", async () => {
		const other = makePriceList({ id: "pl_other", slug: "taken" });
		const ctrl = makeController({
			getPriceListBySlug: vi.fn().mockResolvedValue(other),
		});
		const result = (await call(updatePriceListHandler, {
			params: { id: "pl_1" },
			body: { slug: "taken" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/already exists/i);
	});

	it("allows slug update when same price list owns the slug", async () => {
		const pl = makePriceList({ id: "pl_1", slug: "same-slug" });
		const ctrl = makeController({
			getPriceListBySlug: vi.fn().mockResolvedValue(pl),
			updatePriceList: vi.fn().mockResolvedValue(pl),
		});
		const result = (await call(updatePriceListHandler, {
			params: { id: "pl_1" },
			body: { slug: "same-slug" },
			controller: ctrl,
		})) as { priceList: PriceList };
		expect(result.priceList.id).toBe("pl_1");
	});

	it("returns updated price list on success", async () => {
		const updated = makePriceList({
			id: "pl_3",
			name: "Updated Name",
			status: "inactive",
		});
		const ctrl = makeController({
			updatePriceList: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updatePriceListHandler, {
			params: { id: "pl_3" },
			body: { name: "Updated Name", status: "inactive" },
			controller: ctrl,
		})) as { priceList: PriceList };
		expect(result.priceList.name).toBe("Updated Name");
		expect(result.priceList.status).toBe("inactive");
	});
});

// ── deletePriceList ───────────────────────────────────────────────────────────

describe("admin DELETE /price-lists/:id/delete", () => {
	it("returns 404 when price list not found", async () => {
		const result = (await call(deletePriceListHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Price list not found");
	});

	it("deletes price list and returns success: true", async () => {
		const ctrl = makeController({
			deletePriceList: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deletePriceListHandler, {
			params: { id: "pl_4" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deletePriceList).toHaveBeenCalledWith("pl_4");
	});
});

// ── getStats ──────────────────────────────────────────────────────────────────

describe("admin GET /price-lists/stats", () => {
	it("returns zero-state stats when no price lists exist", async () => {
		const result = (await call(getStatsHandler)) as { stats: PriceListStats };
		expect(result.stats.totalPriceLists).toBe(0);
		expect(result.stats.activePriceLists).toBe(0);
		expect(result.stats.totalEntries).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const stats: PriceListStats = {
			totalPriceLists: 8,
			activePriceLists: 5,
			scheduledPriceLists: 2,
			inactivePriceLists: 1,
			totalEntries: 340,
			priceListsWithEntries: 7,
		};
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(getStatsHandler, { controller: ctrl })) as {
			stats: PriceListStats;
		};
		expect(result.stats.totalPriceLists).toBe(8);
		expect(result.stats.activePriceLists).toBe(5);
		expect(result.stats.totalEntries).toBe(340);
		expect(result.stats.priceListsWithEntries).toBe(7);
	});
});

// ── listEntries ───────────────────────────────────────────────────────────────

describe("admin GET /price-lists/:id/entries", () => {
	it("returns 404 when price list not found", async () => {
		const result = (await call(listEntriesHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Price list not found");
	});

	it("returns entries and total for existing price list", async () => {
		const pl = makePriceList({ id: "pl_5" });
		const entries = [
			makeEntry({ priceListId: "pl_5", productId: "prod_1" }),
			makeEntry({ priceListId: "pl_5", productId: "prod_2" }),
		];
		const ctrl = makeController({
			getPriceList: vi.fn().mockResolvedValue(pl),
			listPrices: vi.fn().mockResolvedValue(entries),
			countPrices: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(listEntriesHandler, {
			params: { id: "pl_5" },
			controller: ctrl,
		})) as { entries: PriceEntry[]; total: number };
		expect(result.entries).toHaveLength(2);
		expect(result.total).toBe(2);
		expect(ctrl.listPrices).toHaveBeenCalledWith(
			"pl_5",
			expect.objectContaining({ take: 50, skip: 0 }),
		);
	});

	it("returns empty entries when price list has no entries", async () => {
		const pl = makePriceList({ id: "pl_6" });
		const ctrl = makeController({
			getPriceList: vi.fn().mockResolvedValue(pl),
			listPrices: vi.fn().mockResolvedValue([]),
			countPrices: vi.fn().mockResolvedValue(0),
		});
		const result = (await call(listEntriesHandler, {
			params: { id: "pl_6" },
			controller: ctrl,
		})) as { entries: PriceEntry[]; total: number };
		expect(result.entries).toHaveLength(0);
		expect(result.total).toBe(0);
	});
});

// ── setEntry ──────────────────────────────────────────────────────────────────

describe("admin POST /price-lists/:id/entries/set", () => {
	it("returns 404 when price list not found", async () => {
		const result = (await call(setEntryHandler, {
			params: { id: "missing" },
			body: { productId: "prod_1", price: 800 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Price list not found");
	});

	it("sets entry and returns it", async () => {
		const pl = makePriceList({ id: "pl_7" });
		const entry = makeEntry({
			priceListId: "pl_7",
			productId: "prod_1",
			price: 800,
		});
		const ctrl = makeController({
			getPriceList: vi.fn().mockResolvedValue(pl),
			setPrice: vi.fn().mockResolvedValue(entry),
		});
		const result = (await call(setEntryHandler, {
			params: { id: "pl_7" },
			body: { productId: "prod_1", price: 800 },
			controller: ctrl,
		})) as { entry: PriceEntry };
		expect(result.entry.price).toBe(800);
		expect(result.entry.productId).toBe("prod_1");
		expect(ctrl.setPrice).toHaveBeenCalledWith(
			expect.objectContaining({
				priceListId: "pl_7",
				productId: "prod_1",
				price: 800,
			}),
		);
	});

	it("forwards compareAtPrice when provided", async () => {
		const pl = makePriceList({ id: "pl_8" });
		const ctrl = makeController({
			getPriceList: vi.fn().mockResolvedValue(pl),
		});
		await call(setEntryHandler, {
			params: { id: "pl_8" },
			body: { productId: "prod_2", price: 750, compareAtPrice: 1000 },
			controller: ctrl,
		});
		expect(ctrl.setPrice).toHaveBeenCalledWith(
			expect.objectContaining({ compareAtPrice: 1000 }),
		);
	});
});

// ── removeEntry ───────────────────────────────────────────────────────────────

describe("admin DELETE /price-lists/:id/entries/:productId/remove", () => {
	it("returns 404 when entry not found", async () => {
		const result = (await call(removeEntryHandler, {
			params: { id: "pl_1", productId: "prod_missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Price entry not found");
	});

	it("removes entry and returns success: true", async () => {
		const ctrl = makeController({
			removePrice: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(removeEntryHandler, {
			params: { id: "pl_1", productId: "prod_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.removePrice).toHaveBeenCalledWith("pl_1", "prod_1");
	});
});

// ── bulkSetEntries ────────────────────────────────────────────────────────────

describe("admin POST /price-lists/:id/entries/bulk", () => {
	it("returns 404 when price list not found", async () => {
		const result = (await call(bulkSetEntriesHandler, {
			params: { id: "missing" },
			body: {
				entries: [{ productId: "prod_1", price: 900 }],
			},
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Price list not found");
	});

	it("bulk sets entries and returns them with count", async () => {
		const pl = makePriceList({ id: "pl_9" });
		const entries = [
			makeEntry({ priceListId: "pl_9", productId: "prod_1", price: 900 }),
			makeEntry({ priceListId: "pl_9", productId: "prod_2", price: 1200 }),
		];
		const ctrl = makeController({
			getPriceList: vi.fn().mockResolvedValue(pl),
			bulkSetPrices: vi.fn().mockResolvedValue(entries),
		});
		const result = (await call(bulkSetEntriesHandler, {
			params: { id: "pl_9" },
			body: {
				entries: [
					{ productId: "prod_1", price: 900 },
					{ productId: "prod_2", price: 1200 },
				],
			},
			controller: ctrl,
		})) as { entries: PriceEntry[]; count: number };
		expect(result.entries).toHaveLength(2);
		expect(result.count).toBe(2);
		expect(ctrl.bulkSetPrices).toHaveBeenCalledWith(
			"pl_9",
			expect.arrayContaining([
				expect.objectContaining({ productId: "prod_1", price: 900 }),
				expect.objectContaining({ productId: "prod_2", price: 1200 }),
			]),
		);
	});

	it("forwards compareAtPrice in bulk entries", async () => {
		const pl = makePriceList({ id: "pl_10" });
		const ctrl = makeController({
			getPriceList: vi.fn().mockResolvedValue(pl),
			bulkSetPrices: vi.fn().mockResolvedValue([]),
		});
		await call(bulkSetEntriesHandler, {
			params: { id: "pl_10" },
			body: {
				entries: [{ productId: "prod_3", price: 500, compareAtPrice: 700 }],
			},
			controller: ctrl,
		});
		expect(ctrl.bulkSetPrices).toHaveBeenCalledWith(
			"pl_10",
			expect.arrayContaining([
				expect.objectContaining({ compareAtPrice: 700 }),
			]),
		);
	});

	it("returns count of 0 when controller returns empty array", async () => {
		const pl = makePriceList({ id: "pl_11" });
		const ctrl = makeController({
			getPriceList: vi.fn().mockResolvedValue(pl),
			bulkSetPrices: vi.fn().mockResolvedValue([]),
		});
		const result = (await call(bulkSetEntriesHandler, {
			params: { id: "pl_11" },
			body: { entries: [{ productId: "prod_4", price: 100 }] },
			controller: ctrl,
		})) as { entries: PriceEntry[]; count: number };
		expect(result.count).toBe(0);
		expect(result.entries).toHaveLength(0);
	});
});
