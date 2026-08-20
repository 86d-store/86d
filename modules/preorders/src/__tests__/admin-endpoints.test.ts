import { describe, expect, it, vi } from "vitest";
import { activateCampaign } from "../admin/endpoints/activate-campaign";
import { cancelCampaign } from "../admin/endpoints/cancel-campaign";
import { cancelItem } from "../admin/endpoints/cancel-item";
import { completeCampaign } from "../admin/endpoints/complete-campaign";
import { createCampaign } from "../admin/endpoints/create-campaign";
import { fulfillItem } from "../admin/endpoints/fulfill-item";
import { getCampaignAdmin } from "../admin/endpoints/get-campaign";
import { listCampaignsAdmin } from "../admin/endpoints/list-campaigns";
import { listItems } from "../admin/endpoints/list-items";
import { markReady } from "../admin/endpoints/mark-ready";
import { notifyCustomers } from "../admin/endpoints/notify-customers";
import { pauseCampaign } from "../admin/endpoints/pause-campaign";
import { preorderSummary } from "../admin/endpoints/preorder-summary";
import { updateCampaign } from "../admin/endpoints/update-campaign";
import type {
	PreorderCampaign,
	PreorderItem,
	PreorderSummary,
	PreordersController,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeCampaign(
	overrides: Partial<PreorderCampaign> = {},
): PreorderCampaign {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		productId: "prod_1",
		productName: "Widget Pro",
		status: "draft",
		paymentType: "full",
		price: 9999,
		currentQuantity: 0,
		startDate: now,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeItem(overrides: Partial<PreorderItem> = {}): PreorderItem {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		campaignId: "camp_1",
		customerId: "cust_1",
		customerEmail: "cust@example.com",
		quantity: 1,
		status: "pending",
		depositPaid: 0,
		totalPrice: 9999,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<PreordersController> = {},
): PreordersController {
	return {
		createCampaign: vi.fn().mockResolvedValue(makeCampaign()),
		getCampaign: vi.fn().mockResolvedValue(null),
		listCampaigns: vi.fn().mockResolvedValue([]),
		updateCampaign: vi.fn().mockResolvedValue(null),
		activateCampaign: vi.fn().mockResolvedValue(null),
		pauseCampaign: vi.fn().mockResolvedValue(null),
		completeCampaign: vi.fn().mockResolvedValue(null),
		cancelCampaign: vi.fn().mockResolvedValue(null),
		placePreorder: vi.fn().mockResolvedValue(null),
		getPreorderItem: vi.fn().mockResolvedValue(null),
		listPreorderItems: vi.fn().mockResolvedValue([]),
		getCustomerPreorders: vi.fn().mockResolvedValue([]),
		cancelPreorderItem: vi.fn().mockResolvedValue(null),
		fulfillPreorderItem: vi.fn().mockResolvedValue(null),
		markReady: vi.fn().mockResolvedValue(null),
		notifyCustomers: vi.fn().mockResolvedValue({ notified: 0, itemIds: [] }),
		getSummary: vi.fn().mockResolvedValue({
			totalCampaigns: 0,
			activeCampaigns: 0,
			totalItems: 0,
			pendingItems: 0,
			confirmedItems: 0,
			fulfilledItems: 0,
			cancelledItems: 0,
			totalRevenue: 0,
			totalDeposits: 0,
		} satisfies PreorderSummary),
		getActiveCampaignForProduct: vi.fn().mockResolvedValue(null),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: PreordersController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { preorders: opts.controller ?? makeController() },
		},
	});
}

const listCampaignsHandler = extractHandler(listCampaignsAdmin);
const createCampaignHandler = extractHandler(createCampaign);
const getCampaignHandler = extractHandler(getCampaignAdmin);
const updateCampaignHandler = extractHandler(updateCampaign);
const activateHandler = extractHandler(activateCampaign);
const pauseHandler = extractHandler(pauseCampaign);
const completeHandler = extractHandler(completeCampaign);
const cancelCampaignHandler = extractHandler(cancelCampaign);
const listItemsHandler = extractHandler(listItems);
const cancelItemHandler = extractHandler(cancelItem);
const fulfillItemHandler = extractHandler(fulfillItem);
const markReadyHandler = extractHandler(markReady);
const notifyHandler = extractHandler(notifyCustomers);
const summaryHandler = extractHandler(preorderSummary);

describe("admin GET /preorders/campaigns", () => {
	it("returns empty list", async () => {
		const result = (await call(listCampaignsHandler)) as {
			campaigns: PreorderCampaign[];
		};
		expect(result.campaigns).toHaveLength(0);
	});

	it("forwards status filter", async () => {
		const ctrl = makeController();
		await call(listCampaignsHandler, {
			query: { status: "active" },
			controller: ctrl,
		});
		expect(ctrl.listCampaigns).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});
});

describe("admin POST /preorders/campaigns/create", () => {
	it("creates a campaign and returns it", async () => {
		const camp = makeCampaign({ productName: "New Item" });
		const ctrl = makeController({
			createCampaign: vi.fn().mockResolvedValue(camp),
		});
		const result = (await call(createCampaignHandler, {
			body: {
				productId: "prod_1",
				productName: "New Item",
				paymentType: "full",
				price: 9999,
				startDate: new Date().toISOString(),
			},
			controller: ctrl,
		})) as { campaign: PreorderCampaign };
		expect(result.campaign.productName).toBe("New Item");
	});
});

describe("admin GET /preorders/campaigns/:id", () => {
	it("returns error when not found", async () => {
		const result = (await call(getCampaignHandler, {
			params: { id: "missing" },
		})) as { error: string; campaign: null };
		expect(result.campaign).toBeNull();
		expect(result.error).toBeDefined();
	});

	it("returns campaign with items when found", async () => {
		const camp = makeCampaign({ id: "camp_1" });
		const items = [makeItem({ campaignId: "camp_1" })];
		const ctrl = makeController({
			getCampaign: vi.fn().mockResolvedValue(camp),
			listPreorderItems: vi.fn().mockResolvedValue(items),
		});
		const result = (await call(getCampaignHandler, {
			params: { id: "camp_1" },
			controller: ctrl,
		})) as { campaign: PreorderCampaign; items: PreorderItem[] };
		expect(result.campaign.id).toBe("camp_1");
		expect(result.items).toHaveLength(1);
	});
});

describe("admin POST /preorders/campaigns/:id/update", () => {
	it("returns error when not found", async () => {
		const result = (await call(updateCampaignHandler, {
			params: { id: "missing" },
			body: { price: 8999 },
		})) as { error: string; campaign: null };
		expect(result.campaign).toBeNull();
	});

	it("updates campaign", async () => {
		const camp = makeCampaign({ price: 8999 });
		const ctrl = makeController({
			updateCampaign: vi.fn().mockResolvedValue(camp),
		});
		const result = (await call(updateCampaignHandler, {
			params: { id: camp.id },
			body: { price: 8999 },
			controller: ctrl,
		})) as { campaign: PreorderCampaign };
		expect(result.campaign.price).toBe(8999);
	});
});

describe("admin POST /preorders/campaigns/:id/activate", () => {
	it("returns error when cannot activate", async () => {
		const result = (await call(activateHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("activates campaign", async () => {
		const camp = makeCampaign({ status: "active" });
		const ctrl = makeController({
			activateCampaign: vi.fn().mockResolvedValue(camp),
		});
		const result = (await call(activateHandler, {
			params: { id: camp.id },
			controller: ctrl,
		})) as { campaign: PreorderCampaign };
		expect(result.campaign.status).toBe("active");
	});
});

describe("admin POST /preorders/campaigns/:id/pause", () => {
	it("returns error when cannot pause", async () => {
		const result = (await call(pauseHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});
});

describe("admin POST /preorders/campaigns/:id/complete", () => {
	it("returns error when cannot complete", async () => {
		const result = (await call(completeHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});
});

describe("admin POST /preorders/campaigns/:id/cancel", () => {
	it("returns error when not found", async () => {
		const result = (await call(cancelCampaignHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("cancels campaign", async () => {
		const camp = makeCampaign({ status: "cancelled" });
		const ctrl = makeController({
			cancelCampaign: vi.fn().mockResolvedValue(camp),
		});
		const result = (await call(cancelCampaignHandler, {
			params: { id: camp.id },
			body: { reason: "Not enough interest" },
			controller: ctrl,
		})) as { campaign: PreorderCampaign };
		expect(result.campaign.status).toBe("cancelled");
	});
});

describe("admin GET /preorders/items", () => {
	it("returns empty list", async () => {
		const result = (await call(listItemsHandler)) as {
			items: PreorderItem[];
		};
		expect(result.items).toHaveLength(0);
	});

	it("forwards campaignId filter", async () => {
		const ctrl = makeController();
		await call(listItemsHandler, {
			query: { campaignId: "camp_1" },
			controller: ctrl,
		});
		expect(ctrl.listPreorderItems).toHaveBeenCalledWith(
			expect.objectContaining({ campaignId: "camp_1" }),
		);
	});
});

describe("admin POST /preorders/items/:id/cancel", () => {
	it("returns error when not found", async () => {
		const result = (await call(cancelItemHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});
});

describe("admin POST /preorders/items/:id/fulfill", () => {
	it("returns error when not found", async () => {
		const result = (await call(fulfillItemHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("fulfills item", async () => {
		const item = makeItem({ status: "fulfilled" });
		const ctrl = makeController({
			fulfillPreorderItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(fulfillItemHandler, {
			params: { id: item.id },
			body: { orderId: "order_1" },
			controller: ctrl,
		})) as { item: PreorderItem };
		expect(result.item.status).toBe("fulfilled");
	});
});

describe("admin POST /preorders/items/:id/mark-ready", () => {
	it("returns error when not found", async () => {
		const result = (await call(markReadyHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("marks item as ready", async () => {
		const item = makeItem({ status: "ready" });
		const ctrl = makeController({ markReady: vi.fn().mockResolvedValue(item) });
		const result = (await call(markReadyHandler, {
			params: { id: item.id },
			controller: ctrl,
		})) as { item: PreorderItem };
		expect(result.item.status).toBe("ready");
	});
});

describe("admin POST /preorders/campaigns/:id/notify", () => {
	it("notifies customers and returns count", async () => {
		const ctrl = makeController({
			notifyCustomers: vi.fn().mockResolvedValue({ notified: 15, itemIds: [] }),
		});
		const result = (await call(notifyHandler, {
			params: { id: "camp_1" },
			controller: ctrl,
		})) as { notified: number };
		expect(result.notified).toBe(15);
	});
});

describe("admin GET /preorders/summary", () => {
	it("returns zero-state summary", async () => {
		const result = (await call(summaryHandler)) as {
			summary: PreorderSummary;
		};
		expect(result.summary.totalCampaigns).toBe(0);
	});

	it("returns real summary", async () => {
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue({
				totalCampaigns: 8,
				activeCampaigns: 3,
				totalItems: 127,
				pendingItems: 50,
				confirmedItems: 60,
				fulfilledItems: 10,
				cancelledItems: 7,
				totalRevenue: 127000,
				totalDeposits: 25000,
			}),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: PreorderSummary;
		};
		expect(result.summary.totalCampaigns).toBe(8);
		expect(result.summary.totalRevenue).toBe(127000);
	});
});
