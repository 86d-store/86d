import { describe, expect, it, vi } from "vitest";
import { archiveRegistry } from "../admin/endpoints/archive-registry";
import { deleteRegistry } from "../admin/endpoints/delete-registry";
import { getRegistry } from "../admin/endpoints/get-registry";
import { listItems } from "../admin/endpoints/list-items";
import { listPurchases } from "../admin/endpoints/list-purchases";
import { listRegistries } from "../admin/endpoints/list-registries";
import { registrySummary } from "../admin/endpoints/registry-summary";
import type {
	GiftRegistryController,
	Registry,
	RegistryItem,
	RegistryPurchase,
	RegistrySummary,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeRegistry(overrides: Partial<Registry> = {}): Registry {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		customerId: "customer-1",
		customerName: "Alice Smith",
		title: "Wedding Registry",
		type: "wedding",
		slug: "alice-wedding",
		visibility: "public",
		status: "active",
		itemCount: 0,
		purchasedCount: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeItem(
	registryId: string,
	overrides: Partial<RegistryItem> = {},
): RegistryItem {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		registryId,
		productId: "prod-1",
		productName: "Blender",
		priceInCents: 4999,
		quantityDesired: 1,
		quantityReceived: 0,
		priority: "nice_to_have",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makePurchase(
	registryId: string,
	overrides: Partial<RegistryPurchase> = {},
): RegistryPurchase {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		registryId,
		registryItemId: "item-1",
		purchaserName: "Bob",
		quantity: 1,
		amountInCents: 4999,
		isAnonymous: false,
		createdAt: now,
		...overrides,
	};
}

function makeSummary(
	overrides: Partial<RegistrySummary> = {},
): RegistrySummary {
	return {
		totalRegistries: 0,
		active: 0,
		completed: 0,
		archived: 0,
		totalItems: 0,
		totalPurchased: 0,
		totalRevenue: 0,
		...overrides,
	};
}

function makeController(
	overrides: Partial<GiftRegistryController> = {},
): GiftRegistryController {
	return {
		createRegistry: vi.fn().mockResolvedValue(makeRegistry()),
		updateRegistry: vi.fn().mockResolvedValue(null),
		getRegistry: vi.fn().mockResolvedValue(null),
		getRegistryBySlug: vi.fn().mockResolvedValue(null),
		listRegistries: vi.fn().mockResolvedValue([]),
		deleteRegistry: vi.fn().mockResolvedValue(false),
		archiveRegistry: vi.fn().mockResolvedValue(null),
		addItem: vi.fn().mockResolvedValue(makeItem("r1")),
		updateItem: vi.fn().mockResolvedValue(null),
		removeItem: vi.fn().mockResolvedValue(false),
		listItems: vi.fn().mockResolvedValue([]),
		getItem: vi.fn().mockResolvedValue(null),
		purchaseItem: vi.fn().mockResolvedValue(makePurchase("r1")),
		listPurchases: vi.fn().mockResolvedValue([]),
		getPurchasesByItem: vi.fn().mockResolvedValue([]),
		getCustomerRegistries: vi.fn().mockResolvedValue([]),
		getRegistrySummary: vi.fn().mockResolvedValue(makeSummary()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: GiftRegistryController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { giftRegistry: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listRegistriesHandler = extractHandler(listRegistries);
const summaryHandler = extractHandler(registrySummary);
const getRegistryHandler = extractHandler(getRegistry);
const deleteRegistryHandler = extractHandler(deleteRegistry);
const archiveRegistryHandler = extractHandler(archiveRegistry);
const listItemsHandler = extractHandler(listItems);
const listPurchasesHandler = extractHandler(listPurchases);

// ── admin GET /gift-registry ──────────────────────────────────────────────────

describe("admin GET /gift-registry", () => {
	it("returns empty list when no registries exist", async () => {
		const result = (await call(listRegistriesHandler)) as {
			registries: Registry[];
		};
		expect(result.registries).toHaveLength(0);
	});

	it("returns registries from controller", async () => {
		const registries = [makeRegistry({ title: "Baby Shower" })];
		const ctrl = makeController({
			listRegistries: vi.fn().mockResolvedValue(registries),
		});
		const result = (await call(listRegistriesHandler, {
			controller: ctrl,
		})) as { registries: Registry[] };
		expect(result.registries).toHaveLength(1);
		expect(result.registries[0].title).toBe("Baby Shower");
	});
});

// ── admin GET /gift-registry/summary ─────────────────────────────────────────

describe("admin GET /gift-registry/summary", () => {
	it("returns zero-state summary", async () => {
		const result = (await call(summaryHandler)) as {
			summary: RegistrySummary;
		};
		expect(result.summary.totalRegistries).toBe(0);
	});

	it("returns real summary from controller", async () => {
		const ctrl = makeController({
			getRegistrySummary: vi.fn().mockResolvedValue(
				makeSummary({
					totalRegistries: 25,
					active: 20,
					totalRevenue: 150000,
				}),
			),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: RegistrySummary;
		};
		expect(result.summary.totalRegistries).toBe(25);
		expect(result.summary.totalRevenue).toBe(150000);
	});
});

// ── admin GET /gift-registry/:id ──────────────────────────────────────────────

describe("admin GET /gift-registry/:id", () => {
	it("returns 404 when registry not found", async () => {
		const result = (await call(getRegistryHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Registry not found");
	});

	it("returns registry with items and purchases when found", async () => {
		const registry = makeRegistry({ id: "r1" });
		const items = [makeItem("r1")];
		const purchases = [makePurchase("r1")];
		const ctrl = makeController({
			getRegistry: vi.fn().mockResolvedValue(registry),
			listItems: vi.fn().mockResolvedValue(items),
			listPurchases: vi.fn().mockResolvedValue(purchases),
		});
		const result = (await call(getRegistryHandler, {
			params: { id: "r1" },
			controller: ctrl,
		})) as {
			registry: Registry;
			items: RegistryItem[];
			recentPurchases: RegistryPurchase[];
		};
		expect(result.registry.id).toBe("r1");
		expect(result.items).toHaveLength(1);
		expect(result.recentPurchases).toHaveLength(1);
	});
});

// ── admin POST /gift-registry/:id/delete ──────────────────────────────────────

describe("admin POST /gift-registry/:id/delete", () => {
	it("returns 404 when registry not found", async () => {
		const result = (await call(deleteRegistryHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns success true when deleted", async () => {
		const ctrl = makeController({
			deleteRegistry: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteRegistryHandler, {
			params: { id: "r2" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── admin POST /gift-registry/:id/archive ─────────────────────────────────────

describe("admin POST /gift-registry/:id/archive", () => {
	it("returns 404 when registry not found", async () => {
		const result = (await call(archiveRegistryHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns archived registry on success", async () => {
		const registry = makeRegistry({ id: "r3", status: "archived" });
		const ctrl = makeController({
			archiveRegistry: vi.fn().mockResolvedValue(registry),
		});
		const result = (await call(archiveRegistryHandler, {
			params: { id: "r3" },
			controller: ctrl,
		})) as { registry: Registry };
		expect(result.registry.status).toBe("archived");
	});
});

// ── admin GET /gift-registry/:id/items ────────────────────────────────────────

describe("admin GET /gift-registry/:id/items", () => {
	it("returns empty items list", async () => {
		const result = (await call(listItemsHandler, {
			params: { id: "r1" },
		})) as { items: RegistryItem[] };
		expect(result.items).toHaveLength(0);
	});

	it("returns items for registry", async () => {
		const items = [makeItem("r4"), makeItem("r4")];
		const ctrl = makeController({
			listItems: vi.fn().mockResolvedValue(items),
		});
		const result = (await call(listItemsHandler, {
			params: { id: "r4" },
			controller: ctrl,
		})) as { items: RegistryItem[] };
		expect(result.items).toHaveLength(2);
		expect(ctrl.listItems).toHaveBeenCalledWith("r4", expect.any(Object));
	});
});

// ── admin GET /gift-registry/:id/purchases ────────────────────────────────────

describe("admin GET /gift-registry/:id/purchases", () => {
	it("returns empty purchases list", async () => {
		const result = (await call(listPurchasesHandler, {
			params: { id: "r1" },
		})) as { purchases: RegistryPurchase[] };
		expect(result.purchases).toHaveLength(0);
	});

	it("returns purchases for registry", async () => {
		const purchases = [makePurchase("r5")];
		const ctrl = makeController({
			listPurchases: vi.fn().mockResolvedValue(purchases),
		});
		const result = (await call(listPurchasesHandler, {
			params: { id: "r5" },
			controller: ctrl,
		})) as { purchases: RegistryPurchase[] };
		expect(result.purchases).toHaveLength(1);
		expect(ctrl.listPurchases).toHaveBeenCalledWith("r5", expect.any(Object));
	});
});
