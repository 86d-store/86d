import { describe, expect, it, vi } from "vitest";
import { addBundleItem } from "../admin/endpoints/add-bundle-item";
import { createBundle } from "../admin/endpoints/create-bundle";
import { deleteBundle } from "../admin/endpoints/delete-bundle";
import { getBundle } from "../admin/endpoints/get-bundle";
import { listBundleItems } from "../admin/endpoints/list-bundle-items";
import { listBundles } from "../admin/endpoints/list-bundles";
import { removeBundleItem } from "../admin/endpoints/remove-bundle-item";
import { updateBundle } from "../admin/endpoints/update-bundle";
import { updateBundleItem } from "../admin/endpoints/update-bundle-item";
import type { Bundle, BundleController, BundleItem } from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeBundle(overrides: Partial<Bundle> = {}): Bundle {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Starter Bundle",
		slug: "starter-bundle",
		status: "active",
		discountType: "percentage",
		discountValue: 10,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeBundleItem(
	bundleId: string,
	overrides: Partial<BundleItem> = {},
): BundleItem {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		bundleId,
		productId: "prod_1",
		quantity: 1,
		createdAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<BundleController> = {},
): BundleController {
	return {
		create: vi.fn().mockResolvedValue(makeBundle()),
		get: vi.fn().mockResolvedValue(null),
		getBySlug: vi.fn().mockResolvedValue(null),
		list: vi.fn().mockResolvedValue([]),
		update: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(false),
		addItem: vi.fn().mockResolvedValue(makeBundleItem("bundle_1")),
		removeItem: vi.fn().mockResolvedValue(false),
		listItems: vi.fn().mockResolvedValue([]),
		updateItem: vi.fn().mockResolvedValue(null),
		getWithItems: vi.fn().mockResolvedValue(null),
		getActiveBySlug: vi.fn().mockResolvedValue(null),
		listActive: vi.fn().mockResolvedValue([]),
		countAll: vi.fn().mockResolvedValue(0),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: BundleController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { bundles: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const addBundleItemHandler = extractHandler(addBundleItem);
const createBundleHandler = extractHandler(createBundle);
const deleteBundleHandler = extractHandler(deleteBundle);
const getBundleHandler = extractHandler(getBundle);
const listBundleItemsHandler = extractHandler(listBundleItems);
const listBundlesHandler = extractHandler(listBundles);
const removeBundleItemHandler = extractHandler(removeBundleItem);
const updateBundleHandler = extractHandler(updateBundle);
const updateBundleItemHandler = extractHandler(updateBundleItem);

// ── admin POST /bundles/:id/items/add ─────────────────────────────────────────

describe("admin POST /bundles/:id/items/add", () => {
	it("returns 404 when bundle not found", async () => {
		const result = (await call(addBundleItemHandler, {
			params: { id: "missing" },
			body: { productId: "prod_1", quantity: 1 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Bundle not found");
	});

	it("adds item to bundle and returns it", async () => {
		const bundle = makeBundle({ id: "bundle_1" });
		const item = makeBundleItem("bundle_1", { productId: "prod_5" });
		const ctrl = makeController({
			get: vi.fn().mockResolvedValue(bundle),
			addItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(addBundleItemHandler, {
			params: { id: "bundle_1" },
			body: { productId: "prod_5", quantity: 2 },
			controller: ctrl,
		})) as { item: BundleItem };
		expect(result.item.productId).toBe("prod_5");
		expect(ctrl.addItem).toHaveBeenCalledWith(
			expect.objectContaining({
				bundleId: "bundle_1",
				productId: "prod_5",
				quantity: 2,
			}),
		);
	});
});

// ── admin POST /bundles/create ────────────────────────────────────────────────

describe("admin POST /bundles/create", () => {
	it("creates a bundle and returns it", async () => {
		const bundle = makeBundle({ name: "Premium Pack", slug: "premium-pack" });
		const ctrl = makeController({
			create: vi.fn().mockResolvedValue(bundle),
		});
		const result = (await call(createBundleHandler, {
			body: {
				name: "Premium Pack",
				slug: "premium-pack",
				discountType: "percentage",
				discountValue: 15,
			},
			controller: ctrl,
		})) as { bundle: Bundle };
		expect(result.bundle.name).toBe("Premium Pack");
		expect(result.bundle.slug).toBe("premium-pack");
		expect(ctrl.create).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Premium Pack",
				discountType: "percentage",
				discountValue: 15,
			}),
		);
	});

	it("creates a fixed discount bundle", async () => {
		const bundle = makeBundle({ discountType: "fixed", discountValue: 500 });
		const ctrl = makeController({
			create: vi.fn().mockResolvedValue(bundle),
		});
		const result = (await call(createBundleHandler, {
			body: {
				name: "Fixed Bundle",
				slug: "fixed-bundle",
				discountType: "fixed",
				discountValue: 500,
			},
			controller: ctrl,
		})) as { bundle: Bundle };
		expect(result.bundle.discountType).toBe("fixed");
	});
});

// ── admin POST /bundles/:id/delete ────────────────────────────────────────────

describe("admin POST /bundles/:id/delete", () => {
	it("returns 404 when bundle not found", async () => {
		const result = (await call(deleteBundleHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes bundle and returns success", async () => {
		const ctrl = makeController({
			delete: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteBundleHandler, {
			params: { id: "bundle_2" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.delete).toHaveBeenCalledWith("bundle_2");
	});
});

// ── admin GET /bundles/:id ────────────────────────────────────────────────────

describe("admin GET /bundles/:id", () => {
	it("returns 404 when bundle not found", async () => {
		const result = (await call(getBundleHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Bundle not found");
	});

	it("returns bundle with items when found", async () => {
		const bundle = makeBundle({ id: "bundle_3" });
		const items = [makeBundleItem("bundle_3"), makeBundleItem("bundle_3")];
		const ctrl = makeController({
			getWithItems: vi.fn().mockResolvedValue({ ...bundle, items }),
		});
		const result = (await call(getBundleHandler, {
			params: { id: "bundle_3" },
			controller: ctrl,
		})) as { bundle: Bundle & { items: BundleItem[] } };
		expect(result.bundle.id).toBe("bundle_3");
		expect(ctrl.getWithItems).toHaveBeenCalledWith("bundle_3");
	});
});

// ── admin GET /bundles/:id/items ──────────────────────────────────────────────

describe("admin GET /bundles/:id/items", () => {
	it("returns empty items list", async () => {
		const result = (await call(listBundleItemsHandler, {
			params: { id: "bundle_1" },
		})) as { items: BundleItem[] };
		expect(result.items).toHaveLength(0);
	});

	it("returns items for given bundle", async () => {
		const items = [
			makeBundleItem("bundle_4", { productId: "prod_a" }),
			makeBundleItem("bundle_4", { productId: "prod_b" }),
		];
		const ctrl = makeController({
			listItems: vi.fn().mockResolvedValue(items),
		});
		const result = (await call(listBundleItemsHandler, {
			params: { id: "bundle_4" },
			controller: ctrl,
		})) as { items: BundleItem[] };
		expect(result.items).toHaveLength(2);
		expect(ctrl.listItems).toHaveBeenCalledWith("bundle_4");
	});
});

// ── admin GET /bundles ────────────────────────────────────────────────────────

describe("admin GET /bundles", () => {
	it("returns empty list and zero total", async () => {
		const result = (await call(listBundlesHandler)) as {
			bundles: Bundle[];
			total: number;
		};
		expect(result.bundles).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns bundles with total count", async () => {
		const bundles = [makeBundle(), makeBundle()];
		const ctrl = makeController({
			list: vi.fn().mockResolvedValue(bundles),
			countAll: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(listBundlesHandler, {
			controller: ctrl,
		})) as { bundles: Bundle[]; total: number };
		expect(result.bundles).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("passes status filter to controller", async () => {
		const ctrl = makeController();
		await call(listBundlesHandler, {
			query: { status: "draft" },
			controller: ctrl,
		});
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({ status: "draft" }),
		);
	});
});

// ── admin POST /bundles/:id/items/:itemId/remove ──────────────────────────────

describe("admin POST /bundles/:id/items/:itemId/remove", () => {
	it("returns 404 when item not found", async () => {
		const result = (await call(removeBundleItemHandler, {
			params: { id: "bundle_1", itemId: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Item not found");
	});

	it("removes item and returns success", async () => {
		const ctrl = makeController({
			removeItem: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(removeBundleItemHandler, {
			params: { id: "bundle_1", itemId: "item_9" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.removeItem).toHaveBeenCalledWith("item_9");
	});
});

// ── admin POST /bundles/:id/update ────────────────────────────────────────────

describe("admin POST /bundles/:id/update", () => {
	it("returns 404 when bundle not found", async () => {
		const result = (await call(updateBundleHandler, {
			params: { id: "missing" },
			body: { name: "New Name" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated bundle on success", async () => {
		const updated = makeBundle({ id: "bundle_5", name: "Renamed Bundle" });
		const ctrl = makeController({
			update: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateBundleHandler, {
			params: { id: "bundle_5" },
			body: { name: "Renamed Bundle" },
			controller: ctrl,
		})) as { bundle: Bundle };
		expect(result.bundle.name).toBe("Renamed Bundle");
		expect(ctrl.update).toHaveBeenCalledWith(
			"bundle_5",
			expect.objectContaining({ name: "Renamed Bundle" }),
		);
	});

	it("returns 400 when percentage discount exceeds 100", async () => {
		const ctrl = makeController();
		const result = (await call(updateBundleHandler, {
			params: { id: "bundle_1" },
			body: { discountType: "percentage", discountValue: 150 },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
	});
});

// ── admin POST /bundles/:id/items/:itemId/update ──────────────────────────────

describe("admin POST /bundles/:id/items/:itemId/update", () => {
	it("returns 404 when item not found", async () => {
		const result = (await call(updateBundleItemHandler, {
			params: { id: "bundle_1", itemId: "missing" },
			body: { quantity: 2 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Item not found");
	});

	it("returns updated item on success", async () => {
		const item = makeBundleItem("bundle_1", { id: "item_7", quantity: 3 });
		const ctrl = makeController({
			updateItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(updateBundleItemHandler, {
			params: { id: "bundle_1", itemId: "item_7" },
			body: { quantity: 3 },
			controller: ctrl,
		})) as { item: BundleItem };
		expect(result.item.quantity).toBe(3);
		expect(ctrl.updateItem).toHaveBeenCalledWith(
			"item_7",
			expect.objectContaining({ quantity: 3 }),
		);
	});
});
