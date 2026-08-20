import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGiftRegistryController } from "../service-impl";

/**
 * Store endpoint integration tests for the gift-registry module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-registry: slug lookup, only public/unlisted visible to guests
 * 2. list-items: items in a registry with pagination
 * 3. purchase-item: records a gift purchase against a registry item
 * 4. my-registries: auth required, lists customer's registries
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ─────────────────────────────────────────────────────────

function createRegistryParams(
	overrides: Partial<Parameters<typeof ctrl.createRegistry>[0]> & {
		title: string;
	},
) {
	return {
		customerId: "cust_1",
		customerName: "Test User",
		type: "wedding" as const,
		...overrides,
	};
}

let ctrl: ReturnType<typeof createGiftRegistryController>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateGetRegistry(data: DataService, slug: string) {
	const controller = createGiftRegistryController(data);
	const registry = await controller.getRegistryBySlug(slug);
	if (!registry || registry.visibility === "private") {
		return { error: "Registry not found", status: 404 };
	}
	return { registry };
}

async function simulateListItems(
	data: DataService,
	registryId: string,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createGiftRegistryController(data);
	const registry = await controller.getRegistry(registryId);
	if (!registry || registry.visibility === "private") {
		return { error: "Registry not found", status: 404 };
	}
	const items = await controller.listItems(registryId, {
		take: query.take ?? 50,
		skip: query.skip ?? 0,
	});
	return { items };
}

async function simulatePurchaseItem(
	data: DataService,
	body: {
		registryId: string;
		registryItemId: string;
		purchaserName: string;
		quantity: number;
		amountInCents: number;
		giftMessage?: string;
	},
) {
	const controller = createGiftRegistryController(data);
	try {
		const purchase = await controller.purchaseItem({
			registryId: body.registryId,
			registryItemId: body.registryItemId,
			purchaserName: body.purchaserName,
			quantity: body.quantity,
			amountInCents: body.amountInCents,
			...(body.giftMessage != null && { giftMessage: body.giftMessage }),
		});
		return { purchase };
	} catch {
		return { error: "Item not found", status: 404 };
	}
}

async function simulateMyRegistries(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createGiftRegistryController(data);
	const registries = await controller.getCustomerRegistries(opts.customerId);
	return { registries };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: get registry — slug lookup", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
		ctrl = createGiftRegistryController(data);
	});

	it("returns a public registry by slug", async () => {
		await ctrl.createRegistry(
			createRegistryParams({
				title: "Wedding Registry",
				slug: "wedding-2026",
				visibility: "public",
			}),
		);

		const result = await simulateGetRegistry(data, "wedding-2026");

		expect("registry" in result).toBe(true);
		if ("registry" in result) {
			expect(result.registry.title).toBe("Wedding Registry");
		}
	});

	it("returns 404 for private registry", async () => {
		await ctrl.createRegistry(
			createRegistryParams({
				title: "Secret List",
				slug: "secret-list",
				type: "other",
				visibility: "private",
			}),
		);

		const result = await simulateGetRegistry(data, "secret-list");

		expect(result).toEqual({ error: "Registry not found", status: 404 });
	});

	it("returns unlisted registry (not private)", async () => {
		await ctrl.createRegistry(
			createRegistryParams({
				title: "Baby Registry",
				slug: "baby-reg",
				type: "baby",
				visibility: "unlisted",
			}),
		);

		const result = await simulateGetRegistry(data, "baby-reg");

		expect("registry" in result).toBe(true);
	});

	it("returns 404 for nonexistent slug", async () => {
		const result = await simulateGetRegistry(data, "nonexistent");

		expect(result).toEqual({ error: "Registry not found", status: 404 });
	});
});

describe("store endpoint: list items — registry items", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
		ctrl = createGiftRegistryController(data);
	});

	it("returns items for a public registry", async () => {
		const reg = await ctrl.createRegistry(
			createRegistryParams({
				title: "Wedding",
				slug: "wedding",
				visibility: "public",
			}),
		);
		await ctrl.addItem({
			registryId: reg.id,
			productId: "prod_toaster",
			productName: "Toaster",
			priceInCents: 4999,
		});
		await ctrl.addItem({
			registryId: reg.id,
			productId: "prod_blender",
			productName: "Blender",
			priceInCents: 7999,
		});

		const result = await simulateListItems(data, reg.id);

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items).toHaveLength(2);
		}
	});

	it("returns 404 for private registry items", async () => {
		const reg = await ctrl.createRegistry(
			createRegistryParams({
				title: "Private",
				slug: "private",
				type: "other",
				visibility: "private",
			}),
		);

		const result = await simulateListItems(data, reg.id);

		expect(result).toEqual({ error: "Registry not found", status: 404 });
	});

	it("returns empty for registry with no items", async () => {
		const reg = await ctrl.createRegistry(
			createRegistryParams({
				title: "Empty",
				slug: "empty",
				visibility: "public",
			}),
		);

		const result = await simulateListItems(data, reg.id);

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items).toHaveLength(0);
		}
	});
});

describe("store endpoint: purchase item — gift purchase", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
		ctrl = createGiftRegistryController(data);
	});

	it("records a purchase against a registry item", async () => {
		const reg = await ctrl.createRegistry(
			createRegistryParams({
				title: "Wedding",
				slug: "wedding",
				visibility: "public",
			}),
		);
		const item = await ctrl.addItem({
			registryId: reg.id,
			productId: "prod_1",
			productName: "Toaster",
			priceInCents: 4999,
			quantityDesired: 2,
		});

		const result = await simulatePurchaseItem(data, {
			registryId: reg.id,
			registryItemId: item.id,
			purchaserName: "Jane",
			quantity: 1,
			amountInCents: 4999,
		});

		expect("purchase" in result).toBe(true);
		if ("purchase" in result) {
			expect(result.purchase.purchaserName).toBe("Jane");
			expect(result.purchase.quantity).toBe(1);
		}
	});

	it("returns 404 for nonexistent item", async () => {
		const result = await simulatePurchaseItem(data, {
			registryId: "ghost_registry",
			registryItemId: "ghost_item",
			purchaserName: "Bob",
			quantity: 1,
			amountInCents: 1000,
		});

		expect(result).toEqual({ error: "Item not found", status: 404 });
	});

	it("includes gift message in purchase", async () => {
		const reg = await ctrl.createRegistry(
			createRegistryParams({
				title: "Registry",
				slug: "registry",
				visibility: "public",
			}),
		);
		const item = await ctrl.addItem({
			registryId: reg.id,
			productId: "prod_1",
			productName: "Mixer",
			priceInCents: 8999,
		});

		const result = await simulatePurchaseItem(data, {
			registryId: reg.id,
			registryItemId: item.id,
			purchaserName: "Bob",
			quantity: 1,
			amountInCents: 8999,
			giftMessage: "Congratulations!",
		});

		expect("purchase" in result).toBe(true);
		if ("purchase" in result) {
			expect(result.purchase.giftMessage).toBe("Congratulations!");
		}
	});
});

describe("store endpoint: my registries — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
		ctrl = createGiftRegistryController(data);
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyRegistries(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns customer's registries", async () => {
		await ctrl.createRegistry(
			createRegistryParams({
				customerId: "cust_1",
				title: "Wedding",
				slug: "wedding",
				visibility: "public",
			}),
		);
		await ctrl.createRegistry(
			createRegistryParams({
				customerId: "cust_2",
				title: "Other",
				slug: "other",
				type: "birthday",
				visibility: "public",
			}),
		);

		const result = await simulateMyRegistries(data, {
			customerId: "cust_1",
		});

		expect("registries" in result).toBe(true);
		if ("registries" in result) {
			expect(result.registries).toHaveLength(1);
			expect(result.registries[0].title).toBe("Wedding");
		}
	});

	it("returns empty for customer with no registries", async () => {
		const result = await simulateMyRegistries(data, {
			customerId: "cust_new",
		});

		expect("registries" in result).toBe(true);
		if ("registries" in result) {
			expect(result.registries).toHaveLength(0);
		}
	});
});
