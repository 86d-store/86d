import { describe, expect, it, vi } from "vitest";
import { campaignStatsEndpoint } from "../admin/endpoints/campaign-stats";
import { createCampaignEndpoint } from "../admin/endpoints/create-campaign";
import { deleteCampaignEndpoint } from "../admin/endpoints/delete-campaign";
import { deleteSubscriberEndpoint } from "../admin/endpoints/delete-subscriber";
import { listCampaignsEndpoint } from "../admin/endpoints/list-campaigns";
import { listSubscribersEndpoint } from "../admin/endpoints/list-subscribers";
import { sendCampaignEndpoint } from "../admin/endpoints/send-campaign";
import { updateCampaignEndpoint } from "../admin/endpoints/update-campaign";
import type {
	Campaign,
	CampaignStats,
	NewsletterController,
	Subscriber,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeSubscriber(overrides: Partial<Subscriber> = {}): Subscriber {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		email: "alice@example.com",
		status: "active",
		tags: [],
		metadata: {},
		subscribedAt: now,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		subject: "Big Sale!",
		body: "<p>Check out our latest deals.</p>",
		status: "draft",
		recipientCount: 0,
		sentCount: 0,
		failedCount: 0,
		tags: [],
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<NewsletterController> = {},
): NewsletterController {
	return {
		subscribe: vi.fn().mockResolvedValue(makeSubscriber()),
		unsubscribe: vi.fn().mockResolvedValue(null),
		resubscribe: vi.fn().mockResolvedValue(null),
		getSubscriber: vi.fn().mockResolvedValue(null),
		getSubscriberByEmail: vi.fn().mockResolvedValue(null),
		updateSubscriber: vi.fn().mockResolvedValue(null),
		deleteSubscriber: vi.fn().mockResolvedValue(false),
		listSubscribers: vi.fn().mockResolvedValue([]),
		createCampaign: vi.fn().mockResolvedValue(makeCampaign()),
		getCampaign: vi.fn().mockResolvedValue(null),
		updateCampaign: vi.fn().mockResolvedValue(null),
		deleteCampaign: vi.fn().mockResolvedValue(false),
		listCampaigns: vi.fn().mockResolvedValue([]),
		sendCampaign: vi.fn().mockResolvedValue(null),
		getCampaignStats: vi.fn().mockResolvedValue({
			total: 0,
			draft: 0,
			scheduled: 0,
			sending: 0,
			sent: 0,
			totalRecipients: 0,
			totalSent: 0,
			totalFailed: 0,
		} satisfies CampaignStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: NewsletterController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { newsletter: opts.controller ?? makeController() },
		},
	});
}

const listSubscribersHandler = extractHandler(listSubscribersEndpoint);
const deleteSubscriberHandler = extractHandler(deleteSubscriberEndpoint);
const listCampaignsHandler = extractHandler(listCampaignsEndpoint);
const createCampaignHandler = extractHandler(createCampaignEndpoint);
const campaignStatsHandler = extractHandler(campaignStatsEndpoint);
const updateCampaignHandler = extractHandler(updateCampaignEndpoint);
const deleteCampaignHandler = extractHandler(deleteCampaignEndpoint);
const sendCampaignHandler = extractHandler(sendCampaignEndpoint);

describe("admin GET /newsletter", () => {
	it("returns empty subscribers list", async () => {
		const result = (await call(listSubscribersHandler)) as {
			subscribers: Subscriber[];
			total: number;
		};
		expect(result.subscribers).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns subscribers from controller", async () => {
		const subscribers = [
			makeSubscriber({ email: "alice@example.com" }),
			makeSubscriber({ email: "bob@example.com" }),
		];
		const ctrl = makeController({
			listSubscribers: vi.fn().mockResolvedValue(subscribers),
		});
		const result = (await call(listSubscribersHandler, {
			controller: ctrl,
		})) as { subscribers: Subscriber[]; total: number };
		expect(result.subscribers).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listSubscribersHandler, {
			query: { status: "unsubscribed" },
			controller: ctrl,
		});
		expect(ctrl.listSubscribers).toHaveBeenCalledWith(
			expect.objectContaining({ status: "unsubscribed" }),
		);
	});
});

describe("admin DELETE /newsletter/:id/delete", () => {
	it("returns deleted=false when subscriber not found", async () => {
		const result = (await call(deleteSubscriberHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted=true when subscriber deleted", async () => {
		const ctrl = makeController({
			deleteSubscriber: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteSubscriberHandler, {
			params: { id: "sub_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.deleteSubscriber).toHaveBeenCalledWith("sub_1");
	});
});

describe("admin GET /newsletter/campaigns", () => {
	it("returns empty campaigns list", async () => {
		const result = (await call(listCampaignsHandler)) as {
			campaigns: Campaign[];
			total: number;
		};
		expect(result.campaigns).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns campaigns from controller", async () => {
		const campaigns = [
			makeCampaign({ subject: "Flash Sale" }),
			makeCampaign({ subject: "New Arrivals", status: "sent" }),
		];
		const ctrl = makeController({
			listCampaigns: vi.fn().mockResolvedValue(campaigns),
		});
		const result = (await call(listCampaignsHandler, {
			controller: ctrl,
		})) as { campaigns: Campaign[]; total: number };
		expect(result.campaigns).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listCampaignsHandler, {
			query: { status: "sent" },
			controller: ctrl,
		});
		expect(ctrl.listCampaigns).toHaveBeenCalledWith(
			expect.objectContaining({ status: "sent" }),
		);
	});
});

describe("admin POST /newsletter/campaigns/create", () => {
	it("creates a campaign and returns it", async () => {
		const campaign = makeCampaign({ subject: "Summer Deals" });
		const ctrl = makeController({
			createCampaign: vi.fn().mockResolvedValue(campaign),
		});
		const result = (await call(createCampaignHandler, {
			body: {
				subject: "Summer Deals",
				body: "<p>Huge summer discounts!</p>",
			},
			controller: ctrl,
		})) as { campaign: Campaign };
		expect(result.campaign.subject).toBe("Summer Deals");
		expect(ctrl.createCampaign).toHaveBeenCalledWith(
			expect.objectContaining({ subject: "Summer Deals" }),
		);
	});

	it("passes tags to controller", async () => {
		const ctrl = makeController();
		await call(createCampaignHandler, {
			body: {
				subject: "Tagged Campaign",
				body: "<p>Body</p>",
				tags: ["promo", "seasonal"],
			},
			controller: ctrl,
		});
		expect(ctrl.createCampaign).toHaveBeenCalledWith(
			expect.objectContaining({ tags: ["promo", "seasonal"] }),
		);
	});
});

describe("admin GET /newsletter/campaigns/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(campaignStatsHandler)) as {
			stats: CampaignStats;
		};
		expect(result.stats.total).toBe(0);
		expect(result.stats.sent).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getCampaignStats: vi.fn().mockResolvedValue({
				total: 10,
				draft: 3,
				scheduled: 2,
				sending: 1,
				sent: 4,
				totalRecipients: 8500,
				totalSent: 8200,
				totalFailed: 300,
			} satisfies CampaignStats),
		});
		const result = (await call(campaignStatsHandler, {
			controller: ctrl,
		})) as { stats: CampaignStats };
		expect(result.stats.total).toBe(10);
		expect(result.stats.sent).toBe(4);
		expect(result.stats.totalSent).toBe(8200);
	});
});

describe("admin PUT /newsletter/campaigns/:id", () => {
	it("returns null campaign with error when not found", async () => {
		const result = (await call(updateCampaignHandler, {
			params: { id: "missing" },
			body: { subject: "Updated" },
		})) as { campaign: Campaign | null; error: string };
		expect(result.campaign).toBeNull();
		expect(result.error).toBe("Campaign not found or not editable");
		expect((result as Record<string, unknown>).status).toBeUndefined();
	});

	it("updates campaign and returns it", async () => {
		const campaign = makeCampaign({ subject: "Updated Subject" });
		const ctrl = makeController({
			updateCampaign: vi.fn().mockResolvedValue(campaign),
		});
		const result = (await call(updateCampaignHandler, {
			params: { id: campaign.id },
			body: { subject: "Updated Subject" },
			controller: ctrl,
		})) as { campaign: Campaign };
		expect(result.campaign.subject).toBe("Updated Subject");
		expect(ctrl.updateCampaign).toHaveBeenCalledWith(
			campaign.id,
			expect.objectContaining({ subject: "Updated Subject" }),
		);
	});
});

describe("admin DELETE /newsletter/campaigns/:id/delete", () => {
	it("returns deleted=false when campaign not found", async () => {
		const result = (await call(deleteCampaignHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted=true when campaign deleted", async () => {
		const ctrl = makeController({
			deleteCampaign: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteCampaignHandler, {
			params: { id: "camp_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.deleteCampaign).toHaveBeenCalledWith("camp_1");
	});
});

describe("admin POST /newsletter/campaigns/:id/send", () => {
	it("returns null campaign with error when not found or already sent", async () => {
		const result = (await call(sendCampaignHandler, {
			params: { id: "missing" },
		})) as { campaign: Campaign | null; error: string };
		expect(result.campaign).toBeNull();
		expect(result.error).toBe("Campaign not found or already sent");
		expect((result as Record<string, unknown>).status).toBeUndefined();
	});

	it("sends campaign and returns it", async () => {
		const campaign = makeCampaign({ status: "sent", sentCount: 500 });
		const ctrl = makeController({
			sendCampaign: vi.fn().mockResolvedValue(campaign),
		});
		const result = (await call(sendCampaignHandler, {
			params: { id: campaign.id },
			controller: ctrl,
		})) as { campaign: Campaign };
		expect(result.campaign.status).toBe("sent");
		expect(result.campaign.sentCount).toBe(500);
		expect(ctrl.sendCampaign).toHaveBeenCalledWith(campaign.id);
	});
});
