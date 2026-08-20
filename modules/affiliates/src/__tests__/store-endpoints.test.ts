import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Affiliate, AffiliateLink } from "../service";
import { createAffiliateController } from "../service-impl";

/**
 * Store endpoint integration tests for the affiliates module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. apply: creates pending affiliate, generates unique code, 409 on duplicate email
 * 2. dashboard: auth required (401), returns data for affiliate, 404 for non-affiliate
 * 3. my-links: auth required, scoped to affiliate, 404 for non-affiliate
 * 4. create-link: auth required, requires approved status (403 if pending), creates link
 * 5. track: finds link by slug, records click + increments counters, 404 for missing/inactive
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate store endpoint logic ─────────────────────────────────────

async function simulateApply(
	data: DataService,
	body: { name: string; email: string; website?: string; notes?: string },
	customerId?: string,
) {
	const controller = createAffiliateController(data);

	const email = customerId ? body.email : body.email;

	const existing = await controller.getAffiliateByEmail(email);
	if (existing)
		return {
			error: "An application with this email already exists",
			status: 409,
		};

	const affiliate = await controller.apply({
		name: body.name,
		email,
		website: body.website,
		customerId,
		notes: body.notes,
	});
	return { affiliate };
}

async function simulateDashboard(data: DataService, customerId?: string) {
	if (!customerId) return { error: "Not authenticated", status: 401 };

	const controller = createAffiliateController(data);

	const affiliates = await controller.listAffiliates();
	const affiliate = affiliates.find((a) => a.customerId === customerId);
	if (!affiliate) return { error: "Not an affiliate", status: 404 };

	const balance = await controller.getAffiliateBalance(affiliate.id);
	const links = await controller.listLinks({ affiliateId: affiliate.id });
	const conversions = await controller.listConversions({
		affiliateId: affiliate.id,
		take: 10,
	});
	const payouts = await controller.listPayouts({
		affiliateId: affiliate.id,
		take: 10,
	});

	return { affiliate, balance, links, conversions, payouts };
}

async function simulateMyLinks(
	data: DataService,
	customerId?: string,
	query: { page?: number; limit?: number } = {},
) {
	if (!customerId) return { error: "Not authenticated", status: 401 };

	const controller = createAffiliateController(data);

	const affiliates = await controller.listAffiliates();
	const affiliate = affiliates.find((a) => a.customerId === customerId);
	if (!affiliate) return { error: "Not an affiliate", status: 404 };

	const limit = query.limit ?? 50;
	const page = query.page ?? 1;
	const skip = (page - 1) * limit;

	const links = await controller.listLinks({
		affiliateId: affiliate.id,
		take: limit,
		skip,
	});
	return { links, total: links.length };
}

async function simulateCreateLink(
	data: DataService,
	body: { targetUrl: string },
	customerId?: string,
) {
	if (!customerId) return { error: "Not authenticated", status: 401 };

	const controller = createAffiliateController(data);

	const affiliates = await controller.listAffiliates();
	const affiliate = affiliates.find((a) => a.customerId === customerId);
	if (!affiliate) return { error: "Not an affiliate", status: 404 };
	if (affiliate.status !== "approved")
		return { error: "Your affiliate account is not active", status: 403 };

	const link = await controller.createLink({
		affiliateId: affiliate.id,
		targetUrl: body.targetUrl,
	});
	if (!link) return { error: "Unable to create link", status: 500 };
	return { link };
}

async function simulateTrack(data: DataService, slug: string) {
	const controller = createAffiliateController(data);

	const link = await controller.getLinkBySlug(slug);
	if (!link) return { error: "Link not found", status: 404 };
	if (!link.active) return { error: "Link is no longer active", status: 404 };

	await controller.recordClick(link.id);
	return { targetUrl: link.targetUrl };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("affiliates store endpoints", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	// ── apply ─────────────────────────────────────────────────────────

	describe("apply", () => {
		it("creates pending affiliate with generated code", async () => {
			const result = await simulateApply(data, {
				name: "Jane Doe",
				email: "jane@example.com",
				website: "https://jane.blog",
				notes: "I have a large audience",
			});

			const res = result as { affiliate: Affiliate };
			expect(res.affiliate.name).toBe("Jane Doe");
			expect(res.affiliate.email).toBe("jane@example.com");
			expect(res.affiliate.website).toBe("https://jane.blog");
			expect(res.affiliate.notes).toBe("I have a large audience");
			expect(res.affiliate.status).toBe("pending");
			expect(res.affiliate.commissionRate).toBe(0);
			expect(res.affiliate.code).toBeTruthy();
			expect(res.affiliate.code.length).toBe(8);
		});

		it("associates customerId when authenticated", async () => {
			const result = await simulateApply(
				data,
				{ name: "Jane", email: "jane@example.com" },
				"cust-1",
			);

			const res = result as { affiliate: Affiliate };
			expect(res.affiliate.customerId).toBe("cust-1");
		});

		it("allows unauthenticated applications", async () => {
			const result = await simulateApply(data, {
				name: "Jane",
				email: "jane@example.com",
			});

			const res = result as { affiliate: Affiliate };
			expect(res.affiliate.customerId).toBeUndefined();
			expect(res.affiliate.status).toBe("pending");
		});

		it("returns 409 when email already applied", async () => {
			await simulateApply(data, {
				name: "Jane",
				email: "jane@example.com",
			});

			const result = await simulateApply(data, {
				name: "Jane Again",
				email: "jane@example.com",
			});

			expect(result).toEqual({
				error: "An application with this email already exists",
				status: 409,
			});
		});
	});

	// ── dashboard ─────────────────────────────────────────────────────

	describe("dashboard", () => {
		it("requires authentication", async () => {
			const result = await simulateDashboard(data);
			expect(result).toEqual({ error: "Not authenticated", status: 401 });
		});

		it("returns 404 when customer is not an affiliate", async () => {
			const result = await simulateDashboard(data, "cust-nobody");
			expect(result).toEqual({ error: "Not an affiliate", status: 404 });
		});

		it("returns affiliate data with balance, links, conversions, and payouts", async () => {
			const controller = createAffiliateController(data);
			const aff = await controller.apply({
				name: "Jane",
				email: "jane@example.com",
				customerId: "cust-1",
			});
			await controller.approveAffiliate(aff.id, 15);
			await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://shop.com/sale",
			});

			const result = await simulateDashboard(data, "cust-1");

			const res = result as {
				affiliate: Affiliate;
				balance: {
					totalCommission: number;
					totalPaid: number;
					balance: number;
				};
				links: AffiliateLink[];
				conversions: unknown[];
				payouts: unknown[];
			};
			expect(res.affiliate.id).toBe(aff.id);
			expect(res.affiliate.commissionRate).toBe(15);
			expect(res.balance).toEqual({
				totalCommission: 0,
				totalPaid: 0,
				balance: 0,
			});
			expect(res.links).toHaveLength(1);
			expect(res.conversions).toHaveLength(0);
			expect(res.payouts).toHaveLength(0);
		});

		it("does not return another customer's affiliate record", async () => {
			const controller = createAffiliateController(data);
			await controller.apply({
				name: "Jane",
				email: "jane@example.com",
				customerId: "cust-other",
			});

			const result = await simulateDashboard(data, "cust-1");
			expect(result).toEqual({ error: "Not an affiliate", status: 404 });
		});
	});

	// ── my-links ──────────────────────────────────────────────────────

	describe("my-links", () => {
		it("requires authentication", async () => {
			const result = await simulateMyLinks(data);
			expect(result).toEqual({ error: "Not authenticated", status: 401 });
		});

		it("returns 404 when customer is not an affiliate", async () => {
			const result = await simulateMyLinks(data, "cust-nobody");
			expect(result).toEqual({ error: "Not an affiliate", status: 404 });
		});

		it("returns links scoped to the affiliate", async () => {
			const controller = createAffiliateController(data);
			const aff = await controller.apply({
				name: "Jane",
				email: "jane@example.com",
				customerId: "cust-1",
			});
			await controller.approveAffiliate(aff.id);
			await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://shop.com/a",
			});
			await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://shop.com/b",
			});

			const result = await simulateMyLinks(data, "cust-1");

			const res = result as { links: AffiliateLink[]; total: number };
			expect(res.links).toHaveLength(2);
			expect(res.total).toBe(2);
			for (const link of res.links) {
				expect(link.affiliateId).toBe(aff.id);
			}
		});

		it("does not return another affiliate's links", async () => {
			const controller = createAffiliateController(data);
			const other = await controller.apply({
				name: "Other",
				email: "other@example.com",
				customerId: "cust-other",
			});
			await controller.approveAffiliate(other.id);
			await controller.createLink({
				affiliateId: other.id,
				targetUrl: "https://shop.com/x",
			});

			const me = await controller.apply({
				name: "Me",
				email: "me@example.com",
				customerId: "cust-1",
			});
			await controller.approveAffiliate(me.id);

			const result = await simulateMyLinks(data, "cust-1");

			const res = result as { links: AffiliateLink[]; total: number };
			expect(res.links).toHaveLength(0);
			expect(res.total).toBe(0);
		});
	});

	// ── create-link ───────────────────────────────────────────────────

	describe("create-link", () => {
		it("requires authentication", async () => {
			const result = await simulateCreateLink(data, {
				targetUrl: "https://shop.com/product",
			});
			expect(result).toEqual({ error: "Not authenticated", status: 401 });
		});

		it("returns 404 when customer is not an affiliate", async () => {
			const result = await simulateCreateLink(
				data,
				{ targetUrl: "https://shop.com/product" },
				"cust-nobody",
			);
			expect(result).toEqual({ error: "Not an affiliate", status: 404 });
		});

		it("returns 403 when affiliate is pending", async () => {
			const controller = createAffiliateController(data);
			await controller.apply({
				name: "Jane",
				email: "jane@example.com",
				customerId: "cust-1",
			});

			const result = await simulateCreateLink(
				data,
				{ targetUrl: "https://shop.com/product" },
				"cust-1",
			);
			expect(result).toEqual({
				error: "Your affiliate account is not active",
				status: 403,
			});
		});

		it("creates link for approved affiliate with slug", async () => {
			const controller = createAffiliateController(data);
			const aff = await controller.apply({
				name: "Jane",
				email: "jane@example.com",
				customerId: "cust-1",
			});
			await controller.approveAffiliate(aff.id);

			const result = await simulateCreateLink(
				data,
				{ targetUrl: "https://shop.com/product" },
				"cust-1",
			);

			const res = result as { link: AffiliateLink };
			expect(res.link.targetUrl).toBe("https://shop.com/product");
			expect(res.link.affiliateId).toBe(aff.id);
			expect(res.link.slug).toBeTruthy();
			expect(res.link.slug.length).toBe(10);
			expect(res.link.clicks).toBe(0);
			expect(res.link.active).toBe(true);
		});

		it("returns 403 when affiliate is suspended", async () => {
			const controller = createAffiliateController(data);
			const aff = await controller.apply({
				name: "Jane",
				email: "jane@example.com",
				customerId: "cust-1",
			});
			await controller.approveAffiliate(aff.id);
			await controller.suspendAffiliate(aff.id);

			const result = await simulateCreateLink(
				data,
				{ targetUrl: "https://shop.com/product" },
				"cust-1",
			);
			expect(result).toEqual({
				error: "Your affiliate account is not active",
				status: 403,
			});
		});
	});

	// ── track ─────────────────────────────────────────────────────────

	describe("track", () => {
		it("returns 404 for nonexistent slug", async () => {
			const result = await simulateTrack(data, "no-such-slug");
			expect(result).toEqual({ error: "Link not found", status: 404 });
		});

		it("records click and returns target URL", async () => {
			const controller = createAffiliateController(data);
			const aff = await controller.apply({
				name: "Jane",
				email: "jane@example.com",
				customerId: "cust-1",
			});
			await controller.approveAffiliate(aff.id);
			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://shop.com/sale",
			});
			expect(link).not.toBeNull();
			const safeLink = link as AffiliateLink;

			const result = await simulateTrack(data, safeLink.slug);

			expect(result).toEqual({ targetUrl: "https://shop.com/sale" });

			// Verify click was recorded on the link
			const updatedLink = await controller.getLink(safeLink.id);
			expect(updatedLink).not.toBeNull();
			expect((updatedLink as AffiliateLink).clicks).toBe(1);

			// Verify affiliate totalClicks was incremented
			const updatedAff = await controller.getAffiliate(aff.id);
			expect(updatedAff).not.toBeNull();
			expect((updatedAff as Affiliate).totalClicks).toBe(1);
		});

		it("increments click counters on repeated tracking", async () => {
			const controller = createAffiliateController(data);
			const aff = await controller.apply({
				name: "Jane",
				email: "jane@example.com",
				customerId: "cust-1",
			});
			await controller.approveAffiliate(aff.id);
			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://shop.com/sale",
			});
			expect(link).not.toBeNull();
			const safeLink = link as AffiliateLink;

			await simulateTrack(data, safeLink.slug);
			await simulateTrack(data, safeLink.slug);
			await simulateTrack(data, safeLink.slug);

			const updatedLink = await controller.getLink(safeLink.id);
			expect(updatedLink).not.toBeNull();
			expect((updatedLink as AffiliateLink).clicks).toBe(3);

			const updatedAff = await controller.getAffiliate(aff.id);
			expect(updatedAff).not.toBeNull();
			expect((updatedAff as Affiliate).totalClicks).toBe(3);
		});

		it("returns 404 for inactive link", async () => {
			const controller = createAffiliateController(data);
			const aff = await controller.apply({
				name: "Jane",
				email: "jane@example.com",
				customerId: "cust-1",
			});
			await controller.approveAffiliate(aff.id);
			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://shop.com/sale",
			});
			expect(link).not.toBeNull();
			const safeLink = link as AffiliateLink;

			await controller.deactivateLink(safeLink.id);

			const result = await simulateTrack(data, safeLink.slug);
			expect(result).toEqual({
				error: "Link is no longer active",
				status: 404,
			});
		});
	});
});
