import { describe, expect, it, vi } from "vitest";
import { approveAffiliateEndpoint } from "../admin/endpoints/approve-affiliate";
import { approveConversionEndpoint } from "../admin/endpoints/approve-conversion";
import { completePayoutEndpoint } from "../admin/endpoints/complete-payout";
import { createPayoutEndpoint } from "../admin/endpoints/create-payout";
import { failPayoutEndpoint } from "../admin/endpoints/fail-payout";
import { getAffiliateEndpoint } from "../admin/endpoints/get-affiliate";
import { listAffiliatesEndpoint } from "../admin/endpoints/list-affiliates";
import { listConversionsEndpoint } from "../admin/endpoints/list-conversions";
import { listLinksEndpoint } from "../admin/endpoints/list-links";
import { listPayoutsEndpoint } from "../admin/endpoints/list-payouts";
import { rejectAffiliateEndpoint } from "../admin/endpoints/reject-affiliate";
import { rejectConversionEndpoint } from "../admin/endpoints/reject-conversion";
import { statsEndpoint } from "../admin/endpoints/stats";
import { suspendAffiliateEndpoint } from "../admin/endpoints/suspend-affiliate";
import { updateAffiliateEndpoint } from "../admin/endpoints/update-affiliate";
import type {
	Affiliate,
	AffiliateController,
	AffiliateConversion,
	AffiliateLink,
	AffiliatePayout,
	AffiliateStats,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeAffiliate(overrides: Partial<Affiliate> = {}): Affiliate {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Alice Referrer",
		email: "alice@example.com",
		code: "ALICE10",
		commissionRate: 10,
		status: "approved",
		totalClicks: 0,
		totalConversions: 0,
		totalRevenue: 0,
		totalCommission: 0,
		totalPaid: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeConversion(
	overrides: Partial<AffiliateConversion> = {},
): AffiliateConversion {
	return {
		id: crypto.randomUUID(),
		affiliateId: "aff_1",
		orderId: "order_1",
		orderAmount: 10000,
		commissionRate: 10,
		commissionAmount: 1000,
		status: "pending",
		createdAt: new Date(),
		...overrides,
	};
}

function makePayout(overrides: Partial<AffiliatePayout> = {}): AffiliatePayout {
	return {
		id: crypto.randomUUID(),
		affiliateId: "aff_1",
		amount: 5000,
		method: "bank_transfer",
		status: "pending",
		createdAt: new Date(),
		...overrides,
	};
}

function makeLink(overrides: Partial<AffiliateLink> = {}): AffiliateLink {
	return {
		id: crypto.randomUUID(),
		affiliateId: "aff_1",
		targetUrl: "https://example.com",
		slug: "alice-ref",
		clicks: 0,
		conversions: 0,
		revenue: 0,
		active: true,
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<AffiliateController> = {},
): AffiliateController {
	return {
		apply: vi.fn().mockResolvedValue(makeAffiliate()),
		getAffiliate: vi.fn().mockResolvedValue(null),
		getAffiliateByCode: vi.fn().mockResolvedValue(null),
		getAffiliateByEmail: vi.fn().mockResolvedValue(null),
		listAffiliates: vi.fn().mockResolvedValue([]),
		approveAffiliate: vi.fn().mockResolvedValue(null),
		suspendAffiliate: vi.fn().mockResolvedValue(null),
		rejectAffiliate: vi.fn().mockResolvedValue(null),
		updateAffiliate: vi.fn().mockResolvedValue(null),
		createLink: vi.fn().mockResolvedValue(makeLink()),
		getLink: vi.fn().mockResolvedValue(null),
		getLinkBySlug: vi.fn().mockResolvedValue(null),
		listLinks: vi.fn().mockResolvedValue([]),
		recordClick: vi.fn().mockResolvedValue(undefined),
		deactivateLink: vi.fn().mockResolvedValue(null),
		recordConversion: vi.fn().mockResolvedValue(makeConversion()),
		getConversion: vi.fn().mockResolvedValue(null),
		listConversions: vi.fn().mockResolvedValue([]),
		approveConversion: vi.fn().mockResolvedValue(null),
		rejectConversion: vi.fn().mockResolvedValue(null),
		createPayout: vi.fn().mockResolvedValue(makePayout()),
		getPayout: vi.fn().mockResolvedValue(null),
		listPayouts: vi.fn().mockResolvedValue([]),
		completePayout: vi.fn().mockResolvedValue(null),
		failPayout: vi.fn().mockResolvedValue(null),
		getStats: vi.fn().mockResolvedValue({
			totalAffiliates: 0,
			activeAffiliates: 0,
			pendingApplications: 0,
			totalClicks: 0,
			totalConversions: 0,
			totalRevenue: 0,
			totalCommission: 0,
			totalPaid: 0,
			conversionRate: 0,
		} satisfies AffiliateStats),
		getAffiliateBalance: vi.fn().mockResolvedValue({ balance: 0, pending: 0 }),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: AffiliateController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { affiliates: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listHandler = extractHandler(listAffiliatesEndpoint);
const getHandler = extractHandler(getAffiliateEndpoint);
const approveHandler = extractHandler(approveAffiliateEndpoint);
const rejectHandler = extractHandler(rejectAffiliateEndpoint);
const suspendHandler = extractHandler(suspendAffiliateEndpoint);
const updateHandler = extractHandler(updateAffiliateEndpoint);
const listLinksHandler = extractHandler(listLinksEndpoint);
const listConversionsHandler = extractHandler(listConversionsEndpoint);
const approveConversionHandler = extractHandler(approveConversionEndpoint);
const rejectConversionHandler = extractHandler(rejectConversionEndpoint);
const listPayoutsHandler = extractHandler(listPayoutsEndpoint);
const createPayoutHandler = extractHandler(createPayoutEndpoint);
const completePayoutHandler = extractHandler(completePayoutEndpoint);
const failPayoutHandler = extractHandler(failPayoutEndpoint);
const statsHandler = extractHandler(statsEndpoint);

// ── listAffiliates ────────────────────────────────────────────────────────────

describe("admin GET /affiliates", () => {
	it("returns empty list when no affiliates", async () => {
		const result = (await call(listHandler)) as { affiliates: Affiliate[] };
		expect(result.affiliates).toHaveLength(0);
	});

	it("returns affiliates from controller", async () => {
		const affiliates = [makeAffiliate(), makeAffiliate()];
		const ctrl = makeController({
			listAffiliates: vi.fn().mockResolvedValue(affiliates),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			affiliates: Affiliate[];
		};
		expect(result.affiliates).toHaveLength(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { status: "pending" },
			controller: ctrl,
		});
		expect(ctrl.listAffiliates).toHaveBeenCalledWith(
			expect.objectContaining({ status: "pending" }),
		);
	});
});

// ── getAffiliate ──────────────────────────────────────────────────────────────

describe("admin GET /affiliates/:id", () => {
	it("returns error when affiliate not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("returns affiliate with links, conversions, payouts, and balance", async () => {
		const aff = makeAffiliate({ id: "aff_1" });
		const links = [makeLink({ affiliateId: "aff_1" })];
		const ctrl = makeController({
			getAffiliate: vi.fn().mockResolvedValue(aff),
			listLinks: vi.fn().mockResolvedValue(links),
			listConversions: vi.fn().mockResolvedValue([]),
			listPayouts: vi.fn().mockResolvedValue([]),
			getAffiliateBalance: vi
				.fn()
				.mockResolvedValue({ balance: 1000, pending: 200 }),
		});
		const result = (await call(getHandler, {
			params: { id: "aff_1" },
			controller: ctrl,
		})) as { affiliate: Affiliate; links: AffiliateLink[] };
		expect(result.affiliate.id).toBe("aff_1");
		expect(result.links).toHaveLength(1);
	});
});

// ── approveAffiliate ──────────────────────────────────────────────────────────

describe("admin POST /affiliates/:id/approve", () => {
	it("returns error when affiliate cannot be approved", async () => {
		const result = (await call(approveHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("approves affiliate with optional commission rate", async () => {
		const aff = makeAffiliate({ status: "approved", commissionRate: 15 });
		const ctrl = makeController({
			approveAffiliate: vi.fn().mockResolvedValue(aff),
		});
		const result = (await call(approveHandler, {
			params: { id: aff.id },
			body: { commissionRate: 15 },
			controller: ctrl,
		})) as { affiliate: Affiliate };
		expect(result.affiliate.status).toBe("approved");
		expect(ctrl.approveAffiliate).toHaveBeenCalledWith(aff.id, 15);
	});
});

// ── rejectAffiliate ───────────────────────────────────────────────────────────

describe("admin POST /affiliates/:id/reject", () => {
	it("returns error when cannot reject", async () => {
		const result = (await call(rejectHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("rejects affiliate", async () => {
		const aff = makeAffiliate({ status: "rejected" });
		const ctrl = makeController({
			rejectAffiliate: vi.fn().mockResolvedValue(aff),
		});
		const result = (await call(rejectHandler, {
			params: { id: aff.id },
			body: { reason: "Doesn't meet requirements" },
			controller: ctrl,
		})) as { affiliate: Affiliate };
		expect(result.affiliate.status).toBe("rejected");
	});
});

// ── suspendAffiliate ──────────────────────────────────────────────────────────

describe("admin POST /affiliates/:id/suspend", () => {
	it("returns error when cannot suspend", async () => {
		const result = (await call(suspendHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("suspends affiliate", async () => {
		const aff = makeAffiliate({ status: "suspended" });
		const ctrl = makeController({
			suspendAffiliate: vi.fn().mockResolvedValue(aff),
		});
		const result = (await call(suspendHandler, {
			params: { id: aff.id },
			body: { reason: "Policy violation" },
			controller: ctrl,
		})) as { affiliate: Affiliate };
		expect(result.affiliate.status).toBe("suspended");
	});
});

// ── updateAffiliate ───────────────────────────────────────────────────────────

describe("admin POST /affiliates/:id/update", () => {
	it("returns error when affiliate not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { commissionRate: 12 },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("updates affiliate and returns it", async () => {
		const aff = makeAffiliate({ commissionRate: 12 });
		const ctrl = makeController({
			updateAffiliate: vi.fn().mockResolvedValue(aff),
		});
		const result = (await call(updateHandler, {
			params: { id: aff.id },
			body: { commissionRate: 12 },
			controller: ctrl,
		})) as { affiliate: Affiliate };
		expect(result.affiliate.commissionRate).toBe(12);
	});
});

// ── listLinks ─────────────────────────────────────────────────────────────────

describe("admin GET /affiliates/links", () => {
	it("returns empty list when no links", async () => {
		const result = (await call(listLinksHandler)) as {
			links: AffiliateLink[];
		};
		expect(result.links).toHaveLength(0);
	});

	it("returns links for affiliate", async () => {
		const links = [makeLink(), makeLink()];
		const ctrl = makeController({
			listLinks: vi.fn().mockResolvedValue(links),
		});
		const result = (await call(listLinksHandler, {
			query: { affiliateId: "aff_1" },
			controller: ctrl,
		})) as { links: AffiliateLink[] };
		expect(result.links).toHaveLength(2);
	});
});

// ── listConversions ───────────────────────────────────────────────────────────

describe("admin GET /affiliates/conversions", () => {
	it("returns empty list when no conversions", async () => {
		const result = (await call(listConversionsHandler)) as {
			conversions: AffiliateConversion[];
		};
		expect(result.conversions).toHaveLength(0);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listConversionsHandler, {
			query: { status: "pending" },
			controller: ctrl,
		});
		expect(ctrl.listConversions).toHaveBeenCalledWith(
			expect.objectContaining({ status: "pending" }),
		);
	});
});

describe("admin POST /affiliates/conversions/:id/approve", () => {
	it("returns error when conversion not found", async () => {
		const result = (await call(approveConversionHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("approves conversion and returns it", async () => {
		const conv = makeConversion({ status: "approved" });
		const ctrl = makeController({
			approveConversion: vi.fn().mockResolvedValue(conv),
		});
		const result = (await call(approveConversionHandler, {
			params: { id: conv.id },
			controller: ctrl,
		})) as { conversion: AffiliateConversion };
		expect(result.conversion.status).toBe("approved");
	});
});

describe("admin POST /affiliates/conversions/:id/reject", () => {
	it("returns error when conversion not found", async () => {
		const result = (await call(rejectConversionHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});
});

// ── Payouts ───────────────────────────────────────────────────────────────────

describe("admin GET /affiliates/payouts", () => {
	it("returns empty list when no payouts", async () => {
		const result = (await call(listPayoutsHandler)) as {
			payouts: AffiliatePayout[];
		};
		expect(result.payouts).toHaveLength(0);
	});
});

describe("admin POST /affiliates/payouts/create", () => {
	it("creates payout and returns it", async () => {
		const payout = makePayout({ affiliateId: "aff_1", amount: 5000 });
		const ctrl = makeController({
			createPayout: vi.fn().mockResolvedValue(payout),
		});
		const result = (await call(createPayoutHandler, {
			body: { affiliateId: "aff_1", amount: 5000, method: "bank_transfer" },
			controller: ctrl,
		})) as { payout: AffiliatePayout };
		expect(result.payout.amount).toBe(5000);
	});
});

describe("admin POST /affiliates/payouts/:id/complete", () => {
	it("returns error when payout not found", async () => {
		const result = (await call(completePayoutHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("completes payout and returns it", async () => {
		const payout = makePayout({ status: "completed" });
		const ctrl = makeController({
			completePayout: vi.fn().mockResolvedValue(payout),
		});
		const result = (await call(completePayoutHandler, {
			params: { id: payout.id },
			controller: ctrl,
		})) as { payout: AffiliatePayout };
		expect(result.payout.status).toBe("completed");
	});
});

describe("admin POST /affiliates/payouts/:id/fail", () => {
	it("returns error when payout not found", async () => {
		const result = (await call(failPayoutHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});
});

// ── Stats ─────────────────────────────────────────────────────────────────────

describe("admin GET /affiliates/stats", () => {
	it("returns zero-state stats when no affiliates", async () => {
		const result = (await call(statsHandler)) as { stats: AffiliateStats };
		expect(result.stats.totalAffiliates).toBe(0);
		expect(result.stats.conversionRate).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalAffiliates: 25,
				activeAffiliates: 18,
				pendingApplications: 3,
				totalClicks: 1240,
				totalConversions: 87,
				totalRevenue: 870000,
				totalCommission: 87000,
				totalPaid: 62000,
				conversionRate: 7.02,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: AffiliateStats;
		};
		expect(result.stats.totalAffiliates).toBe(25);
		expect(result.stats.totalRevenue).toBe(870000);
	});
});
