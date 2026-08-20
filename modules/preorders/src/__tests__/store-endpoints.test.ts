import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPreordersController } from "../service-impl";

/**
 * Store endpoint integration tests for the preorders module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-active-campaign: returns active campaign for a product (public)
 * 2. place-preorder: auth required, places a preorder on active campaign
 * 3. my-preorders: auth required, lists customer's preorder items
 * 4. cancel-preorder: auth required, cancels own preorder item
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ─────────────────────────────────────────────────────────

async function createActiveCampaign(
	ctrl: ReturnType<typeof createPreordersController>,
	overrides: Partial<Parameters<typeof ctrl.createCampaign>[0]> & {
		productName: string;
	},
) {
	const productId =
		overrides.productId ??
		`prod_${overrides.productName.toLowerCase().replace(/\s+/g, "_")}`;
	// startDate in the past auto-sets status to "active" in createCampaign
	const campaign = await ctrl.createCampaign({
		productId,
		paymentType: "full",
		price: 4999,
		maxQuantity: 100,
		startDate: new Date(Date.now() - 86400000),
		endDate: new Date(Date.now() + 7 * 86400000),
		...overrides,
	});
	return campaign;
}

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateGetActiveCampaign(
	data: DataService,
	productId: string,
	variantId?: string,
) {
	const controller = createPreordersController(data);
	const campaign = await controller.getActiveCampaignForProduct(
		productId,
		variantId,
	);
	if (!campaign) return { campaign: null };
	return { campaign };
}

async function simulatePlacePreorder(
	data: DataService,
	body: { campaignId: string; quantity?: number },
	opts: { customerId?: string; customerEmail?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createPreordersController(data);
	const campaign = await controller.getCampaign(body.campaignId);
	if (!campaign || campaign.status !== "active") {
		return { error: "Campaign not found or not active", status: 404 };
	}
	const item = await controller.placePreorder({
		campaignId: body.campaignId,
		customerId: opts.customerId,
		customerEmail: opts.customerEmail ?? `${opts.customerId}@example.com`,
		quantity: body.quantity ?? 1,
	});
	if (!item) {
		return { error: "Could not place preorder", status: 400 };
	}
	return { item };
}

async function simulateMyPreorders(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createPreordersController(data);
	const items = await controller.getCustomerPreorders(opts.customerId);
	return { items };
}

async function simulateCancelPreorder(
	data: DataService,
	itemId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createPreordersController(data);
	const item = await controller.getPreorderItem(itemId);
	if (!item || item.customerId !== opts.customerId) {
		return { error: "Preorder not found", status: 404 };
	}
	const cancelled = await controller.cancelPreorderItem(
		itemId,
		"Customer requested",
	);
	if (!cancelled) {
		return { error: "Could not cancel preorder", status: 400 };
	}
	return { item: cancelled };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: get active campaign — public", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns active campaign for a product", async () => {
		const ctrl = createPreordersController(data);
		await createActiveCampaign(ctrl, {
			productName: "New Phone",
			productId: "prod_phone",
			price: 99900,
		});

		const result = await simulateGetActiveCampaign(data, "prod_phone");

		expect(result.campaign).not.toBeNull();
		expect(result.campaign?.status).toBe("active");
		expect(result.campaign?.price).toBe(99900);
	});

	it("returns null when no active campaign exists", async () => {
		const result = await simulateGetActiveCampaign(data, "prod_nothing");

		expect(result.campaign).toBeNull();
	});

	it("returns null for draft campaign (not yet active)", async () => {
		const ctrl = createPreordersController(data);
		await ctrl.createCampaign({
			productId: "prod_draft",
			productName: "Draft Product",
			paymentType: "full",
			price: 2999,
			maxQuantity: 50,
			startDate: new Date(Date.now() + 86400000),
			endDate: new Date(Date.now() + 7 * 86400000),
		});

		const result = await simulateGetActiveCampaign(data, "prod_draft");

		expect(result.campaign).toBeNull();
	});

	it("returns null for completed campaign", async () => {
		const ctrl = createPreordersController(data);
		const campaign = await createActiveCampaign(ctrl, {
			productName: "Old Product",
			productId: "prod_old",
		});
		await ctrl.completeCampaign(campaign.id);

		const result = await simulateGetActiveCampaign(data, "prod_old");

		expect(result.campaign).toBeNull();
	});
});

describe("store endpoint: place preorder — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulatePlacePreorder(data, {
			campaignId: "camp_1",
		});
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("places a preorder on active campaign", async () => {
		const ctrl = createPreordersController(data);
		const campaign = await createActiveCampaign(ctrl, {
			productName: "Widget",
		});

		const result = await simulatePlacePreorder(
			data,
			{ campaignId: campaign.id },
			{ customerId: "cust_1", customerEmail: "cust1@example.com" },
		);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.customerId).toBe("cust_1");
			expect(result.item.status).toBe("pending");
		}
	});

	it("returns 404 for non-active campaign", async () => {
		const ctrl = createPreordersController(data);
		const campaign = await ctrl.createCampaign({
			productId: "prod_1",
			productName: "Draft",
			paymentType: "full",
			price: 999,
			maxQuantity: 10,
			startDate: new Date(Date.now() + 86400000),
			endDate: new Date(Date.now() + 7 * 86400000),
		});

		const result = await simulatePlacePreorder(
			data,
			{ campaignId: campaign.id },
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Campaign not found or not active",
			status: 404,
		});
	});

	it("places preorder with quantity", async () => {
		const ctrl = createPreordersController(data);
		const campaign = await createActiveCampaign(ctrl, {
			productName: "Gadget",
		});

		const result = await simulatePlacePreorder(
			data,
			{ campaignId: campaign.id, quantity: 3 },
			{ customerId: "cust_1", customerEmail: "cust1@example.com" },
		);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.quantity).toBe(3);
		}
	});
});

describe("store endpoint: my preorders — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyPreorders(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns customer's preorder items", async () => {
		const ctrl = createPreordersController(data);
		const campaign = await createActiveCampaign(ctrl, {
			productName: "Widget",
		});
		await ctrl.placePreorder({
			campaignId: campaign.id,
			customerId: "cust_1",
			customerEmail: "cust1@example.com",
			quantity: 1,
		});

		const result = await simulateMyPreorders(data, {
			customerId: "cust_1",
		});

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items).toHaveLength(1);
			expect(result.items[0].customerId).toBe("cust_1");
		}
	});

	it("returns empty for customer with no preorders", async () => {
		const result = await simulateMyPreorders(data, {
			customerId: "cust_none",
		});

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items).toHaveLength(0);
		}
	});

	it("does not include other customers' preorders", async () => {
		const ctrl = createPreordersController(data);
		const campaign = await createActiveCampaign(ctrl, {
			productName: "Widget",
		});
		await ctrl.placePreorder({
			campaignId: campaign.id,
			customerId: "cust_other",
			customerEmail: "other@example.com",
			quantity: 1,
		});

		const result = await simulateMyPreorders(data, {
			customerId: "cust_1",
		});

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items).toHaveLength(0);
		}
	});
});

describe("store endpoint: cancel preorder — auth + ownership", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateCancelPreorder(data, "item_1");
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("cancels own preorder", async () => {
		const ctrl = createPreordersController(data);
		const campaign = await createActiveCampaign(ctrl, {
			productName: "Widget",
		});
		const item = await ctrl.placePreorder({
			campaignId: campaign.id,
			customerId: "cust_1",
			customerEmail: "cust1@example.com",
			quantity: 1,
		});
		expect(item).not.toBeNull();

		const result = await simulateCancelPreorder(data, item?.id ?? "", {
			customerId: "cust_1",
		});

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.status).toBe("cancelled");
		}
	});

	it("returns 404 for another customer's preorder", async () => {
		const ctrl = createPreordersController(data);
		const campaign = await createActiveCampaign(ctrl, {
			productName: "Widget",
		});
		const item = await ctrl.placePreorder({
			campaignId: campaign.id,
			customerId: "cust_1",
			customerEmail: "cust1@example.com",
			quantity: 1,
		});
		expect(item).not.toBeNull();

		const result = await simulateCancelPreorder(data, item?.id ?? "", {
			customerId: "cust_2",
		});

		expect(result).toEqual({ error: "Preorder not found", status: 404 });
	});

	it("returns 404 for nonexistent preorder", async () => {
		const result = await simulateCancelPreorder(data, "ghost_id", {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Preorder not found", status: 404 });
	});
});
