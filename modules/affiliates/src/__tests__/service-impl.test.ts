import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAffiliateController } from "../service-impl";

function unwrap<T>(value: T | null | undefined): T {
	expect(value).not.toBeNull();
	return value as T;
}

describe("createAffiliateController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAffiliateController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAffiliateController(mockData);
	});

	// ── Applications ──────────────────────────────────────────────────

	describe("apply", () => {
		it("creates a pending affiliate application", async () => {
			const affiliate = await controller.apply({
				name: "Alice Blog",
				email: "alice@example.com",
				website: "https://alice.blog",
			});
			expect(affiliate.id).toBeDefined();
			expect(affiliate.name).toBe("Alice Blog");
			expect(affiliate.email).toBe("alice@example.com");
			expect(affiliate.website).toBe("https://alice.blog");
			expect(affiliate.code).toHaveLength(8);
			expect(affiliate.status).toBe("pending");
			expect(affiliate.commissionRate).toBe(0);
			expect(affiliate.totalClicks).toBe(0);
			expect(affiliate.totalConversions).toBe(0);
			expect(affiliate.totalRevenue).toBe(0);
			expect(affiliate.totalCommission).toBe(0);
			expect(affiliate.totalPaid).toBe(0);
			expect(affiliate.createdAt).toBeInstanceOf(Date);
		});

		it("creates with optional customerId and notes", async () => {
			const affiliate = await controller.apply({
				name: "Bob",
				email: "bob@example.com",
				customerId: "cust-1",
				notes: "I run a tech blog with 50k monthly visitors",
			});
			expect(affiliate.customerId).toBe("cust-1");
			expect(affiliate.notes).toBe(
				"I run a tech blog with 50k monthly visitors",
			);
		});

		it("generates unique codes", async () => {
			const a = await controller.apply({
				name: "A",
				email: "a@example.com",
			});
			const b = await controller.apply({
				name: "B",
				email: "b@example.com",
			});
			expect(a.code).not.toBe(b.code);
		});
	});

	// ── Getters ────────────────────────────────────────────────────────

	describe("getAffiliate", () => {
		it("returns affiliate by id", async () => {
			const created = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const found = await controller.getAffiliate(created.id);
			expect(found?.name).toBe("Alice");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getAffiliate("missing");
			expect(found).toBeNull();
		});
	});

	describe("getAffiliateByCode", () => {
		it("returns affiliate by code", async () => {
			const created = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const found = await controller.getAffiliateByCode(created.code);
			expect(found?.id).toBe(created.id);
		});

		it("returns null for non-existent code", async () => {
			const found = await controller.getAffiliateByCode("NONEXIST");
			expect(found).toBeNull();
		});
	});

	describe("getAffiliateByEmail", () => {
		it("returns affiliate by email", async () => {
			await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const found = await controller.getAffiliateByEmail("alice@example.com");
			expect(found?.name).toBe("Alice");
		});

		it("returns null for non-existent email", async () => {
			const found = await controller.getAffiliateByEmail("nobody@example.com");
			expect(found).toBeNull();
		});
	});

	describe("listAffiliates", () => {
		it("lists all affiliates", async () => {
			await controller.apply({ name: "A", email: "a@example.com" });
			await controller.apply({ name: "B", email: "b@example.com" });
			const all = await controller.listAffiliates();
			expect(all).toHaveLength(2);
		});

		it("filters by status", async () => {
			const a = await controller.apply({
				name: "A",
				email: "a@example.com",
			});
			await controller.apply({ name: "B", email: "b@example.com" });
			await controller.approveAffiliate(a.id);

			const approved = await controller.listAffiliates({
				status: "approved",
			});
			expect(approved).toHaveLength(1);
			expect(approved[0].name).toBe("A");

			const pending = await controller.listAffiliates({
				status: "pending",
			});
			expect(pending).toHaveLength(1);
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.apply({
					name: `Aff-${i}`,
					email: `aff${i}@example.com`,
				});
			}
			const page = await controller.listAffiliates({
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── Status transitions ────────────────────────────────────────────

	describe("approveAffiliate", () => {
		it("approves a pending affiliate with default commission", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const approved = await controller.approveAffiliate(aff.id);
			expect(approved?.status).toBe("approved");
			expect(approved?.commissionRate).toBe(10);
		});

		it("approves with custom commission rate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const approved = await controller.approveAffiliate(aff.id, 15);
			expect(approved?.commissionRate).toBe(15);
		});

		it("returns null for non-pending affiliate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id);
			const again = await controller.approveAffiliate(aff.id);
			expect(again).toBeNull();
		});

		it("returns null for non-existent affiliate", async () => {
			const result = await controller.approveAffiliate("missing");
			expect(result).toBeNull();
		});
	});

	describe("suspendAffiliate", () => {
		it("suspends an approved affiliate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id);
			const suspended = await controller.suspendAffiliate(aff.id);
			expect(suspended?.status).toBe("suspended");
		});

		it("returns null for non-approved affiliate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const result = await controller.suspendAffiliate(aff.id);
			expect(result).toBeNull();
		});
	});

	describe("rejectAffiliate", () => {
		it("rejects a pending affiliate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const rejected = await controller.rejectAffiliate(aff.id);
			expect(rejected?.status).toBe("rejected");
		});

		it("returns null for non-pending affiliate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id);
			const result = await controller.rejectAffiliate(aff.id);
			expect(result).toBeNull();
		});
	});

	describe("updateAffiliate", () => {
		it("updates affiliate fields", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const updated = await controller.updateAffiliate(aff.id, {
				name: "Alice Updated",
				website: "https://alice.dev",
			});
			expect(updated?.name).toBe("Alice Updated");
			expect(updated?.website).toBe("https://alice.dev");
			expect(updated?.email).toBe("alice@example.com");
		});

		it("updates commission rate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const updated = await controller.updateAffiliate(aff.id, {
				commissionRate: 20,
			});
			expect(updated?.commissionRate).toBe(20);
		});

		it("returns null for non-existent affiliate", async () => {
			const result = await controller.updateAffiliate("missing", {
				name: "Nope",
			});
			expect(result).toBeNull();
		});
	});

	// ── Links ──────────────────────────────────────────────────────────

	describe("createLink", () => {
		it("creates a tracking link for approved affiliate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id);

			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/product/1",
			});
			expect(link).not.toBeNull();
			expect(link?.affiliateId).toBe(aff.id);
			expect(link?.targetUrl).toBe("https://store.com/product/1");
			expect(link?.slug).toHaveLength(10);
			expect(link?.clicks).toBe(0);
			expect(link?.conversions).toBe(0);
			expect(link?.active).toBe(true);
		});

		it("returns null for non-approved affiliate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/product/1",
			});
			expect(link).toBeNull();
		});

		it("returns null for non-existent affiliate", async () => {
			const link = await controller.createLink({
				affiliateId: "missing",
				targetUrl: "https://store.com",
			});
			expect(link).toBeNull();
		});
	});

	describe("getLink", () => {
		it("returns link by id", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id);
			const created = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/product/1",
			});
			const found = await controller.getLink(unwrap(created).id);
			expect(found?.targetUrl).toBe("https://store.com/product/1");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getLink("missing");
			expect(found).toBeNull();
		});
	});

	describe("getLinkBySlug", () => {
		it("returns link by slug", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id);
			const created = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/product/1",
			});
			const found = await controller.getLinkBySlug(unwrap(created).slug);
			expect(found?.id).toBe(unwrap(created).id);
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getLinkBySlug("nonexistent");
			expect(found).toBeNull();
		});
	});

	describe("listLinks", () => {
		it("lists all links", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id);
			await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/1",
			});
			await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/2",
			});
			const all = await controller.listLinks();
			expect(all).toHaveLength(2);
		});

		it("filters by affiliateId", async () => {
			const a1 = await controller.apply({
				name: "A",
				email: "a@example.com",
			});
			const a2 = await controller.apply({
				name: "B",
				email: "b@example.com",
			});
			await controller.approveAffiliate(a1.id);
			await controller.approveAffiliate(a2.id);
			await controller.createLink({
				affiliateId: a1.id,
				targetUrl: "https://store.com/1",
			});
			await controller.createLink({
				affiliateId: a2.id,
				targetUrl: "https://store.com/2",
			});

			const filtered = await controller.listLinks({
				affiliateId: a1.id,
			});
			expect(filtered).toHaveLength(1);
		});

		it("filters by active status", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id);
			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/1",
			});
			await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/2",
			});
			await controller.deactivateLink(unwrap(link).id);

			const active = await controller.listLinks({ active: true });
			expect(active).toHaveLength(1);

			const inactive = await controller.listLinks({ active: false });
			expect(inactive).toHaveLength(1);
		});
	});

	describe("recordClick", () => {
		it("increments click count on link and affiliate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id);
			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/1",
			});

			const updated = await controller.recordClick(unwrap(link).id);
			expect(updated?.clicks).toBe(1);

			await controller.recordClick(unwrap(link).id);
			const afterTwo = await controller.getLink(unwrap(link).id);
			expect(afterTwo?.clicks).toBe(2);

			const updatedAff = await controller.getAffiliate(aff.id);
			expect(updatedAff?.totalClicks).toBe(2);
		});

		it("returns null for inactive link", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id);
			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/1",
			});
			await controller.deactivateLink(unwrap(link).id);
			const result = await controller.recordClick(unwrap(link).id);
			expect(result).toBeNull();
		});

		it("returns null for non-existent link", async () => {
			const result = await controller.recordClick("missing");
			expect(result).toBeNull();
		});
	});

	describe("deactivateLink", () => {
		it("deactivates a link", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id);
			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/1",
			});
			const deactivated = await controller.deactivateLink(unwrap(link).id);
			expect(deactivated?.active).toBe(false);
		});

		it("returns null for non-existent link", async () => {
			const result = await controller.deactivateLink("missing");
			expect(result).toBeNull();
		});
	});

	// ── Conversions ───────────────────────────────────────────────────

	describe("recordConversion", () => {
		it("records a conversion with calculated commission", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/1",
			});

			const conversion = await controller.recordConversion({
				affiliateId: aff.id,
				linkId: unwrap(link).id,
				orderId: "order-1",
				orderAmount: 100,
			});
			expect(conversion).not.toBeNull();
			expect(conversion?.affiliateId).toBe(aff.id);
			expect(conversion?.orderId).toBe("order-1");
			expect(conversion?.orderAmount).toBe(100);
			expect(conversion?.commissionRate).toBe(10);
			expect(conversion?.commissionAmount).toBe(10);
			expect(conversion?.status).toBe("pending");
		});

		it("updates link stats when linkId provided", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com/1",
			});

			await controller.recordConversion({
				affiliateId: aff.id,
				linkId: unwrap(link).id,
				orderId: "order-1",
				orderAmount: 200,
			});

			const updatedLink = await controller.getLink(unwrap(link).id);
			expect(updatedLink?.conversions).toBe(1);
			expect(updatedLink?.revenue).toBe(200);
		});

		it("returns null for non-approved affiliate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const result = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 100,
			});
			expect(result).toBeNull();
		});

		it("returns null for non-existent affiliate", async () => {
			const result = await controller.recordConversion({
				affiliateId: "missing",
				orderId: "order-1",
				orderAmount: 100,
			});
			expect(result).toBeNull();
		});
	});

	describe("getConversion", () => {
		it("returns conversion by id", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const conversion = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 100,
			});
			const found = await controller.getConversion(unwrap(conversion).id);
			expect(found?.orderId).toBe("order-1");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getConversion("missing");
			expect(found).toBeNull();
		});
	});

	describe("listConversions", () => {
		it("lists all conversions", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 100,
			});
			await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-2",
				orderAmount: 200,
			});
			const all = await controller.listConversions();
			expect(all).toHaveLength(2);
		});

		it("filters by affiliateId", async () => {
			const a1 = await controller.apply({
				name: "A",
				email: "a@example.com",
			});
			const a2 = await controller.apply({
				name: "B",
				email: "b@example.com",
			});
			await controller.approveAffiliate(a1.id, 10);
			await controller.approveAffiliate(a2.id, 10);
			await controller.recordConversion({
				affiliateId: a1.id,
				orderId: "order-1",
				orderAmount: 100,
			});
			await controller.recordConversion({
				affiliateId: a2.id,
				orderId: "order-2",
				orderAmount: 200,
			});

			const filtered = await controller.listConversions({
				affiliateId: a1.id,
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].affiliateId).toBe(a1.id);
		});

		it("filters by status", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const c1 = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 100,
			});
			await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-2",
				orderAmount: 200,
			});
			await controller.approveConversion(unwrap(c1).id);

			const approved = await controller.listConversions({
				status: "approved",
			});
			expect(approved).toHaveLength(1);

			const pending = await controller.listConversions({
				status: "pending",
			});
			expect(pending).toHaveLength(1);
		});
	});

	describe("approveConversion", () => {
		it("approves a pending conversion and updates affiliate totals", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const conversion = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 100,
			});

			const approved = await controller.approveConversion(
				unwrap(conversion).id,
			);
			expect(approved?.status).toBe("approved");

			const updatedAff = await controller.getAffiliate(aff.id);
			expect(updatedAff?.totalConversions).toBe(1);
			expect(updatedAff?.totalRevenue).toBe(100);
			expect(updatedAff?.totalCommission).toBe(10);
		});

		it("returns null for non-pending conversion", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const conversion = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 100,
			});
			await controller.approveConversion(unwrap(conversion).id);
			const again = await controller.approveConversion(unwrap(conversion).id);
			expect(again).toBeNull();
		});

		it("returns null for non-existent conversion", async () => {
			const result = await controller.approveConversion("missing");
			expect(result).toBeNull();
		});
	});

	describe("rejectConversion", () => {
		it("rejects a pending conversion", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const conversion = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 100,
			});
			const rejected = await controller.rejectConversion(unwrap(conversion).id);
			expect(rejected?.status).toBe("rejected");
		});

		it("returns null for non-pending conversion", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const conversion = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 100,
			});
			await controller.approveConversion(unwrap(conversion).id);
			const result = await controller.rejectConversion(unwrap(conversion).id);
			expect(result).toBeNull();
		});
	});

	// ── Payouts ───────────────────────────────────────────────────────

	describe("createPayout", () => {
		it("creates a payout for affiliate with balance", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const conversion = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 1000,
			});
			await controller.approveConversion(unwrap(conversion).id);

			const payout = await controller.createPayout({
				affiliateId: aff.id,
				amount: 50,
				method: "paypal",
				reference: "PP-12345",
			});
			expect(payout).not.toBeNull();
			expect(payout?.amount).toBe(50);
			expect(payout?.method).toBe("paypal");
			expect(payout?.reference).toBe("PP-12345");
			expect(payout?.status).toBe("pending");
		});

		it("prevents payout exceeding balance", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const conversion = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 100,
			});
			await controller.approveConversion(unwrap(conversion).id);

			// Commission is $10, try to pay $20
			const payout = await controller.createPayout({
				affiliateId: aff.id,
				amount: 20,
				method: "bank_transfer",
			});
			expect(payout).toBeNull();
		});

		it("returns null for non-approved affiliate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const payout = await controller.createPayout({
				affiliateId: aff.id,
				amount: 10,
				method: "paypal",
			});
			expect(payout).toBeNull();
		});

		it("returns null for non-existent affiliate", async () => {
			const payout = await controller.createPayout({
				affiliateId: "missing",
				amount: 10,
				method: "paypal",
			});
			expect(payout).toBeNull();
		});
	});

	describe("getPayout", () => {
		it("returns payout by id", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const conversion = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 1000,
			});
			await controller.approveConversion(unwrap(conversion).id);
			const created = await controller.createPayout({
				affiliateId: aff.id,
				amount: 50,
				method: "paypal",
			});
			const found = await controller.getPayout(unwrap(created).id);
			expect(found?.amount).toBe(50);
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getPayout("missing");
			expect(found).toBeNull();
		});
	});

	describe("listPayouts", () => {
		it("lists all payouts", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const c = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "order-1",
				orderAmount: 5000,
			});
			await controller.approveConversion(unwrap(c).id);
			await controller.createPayout({
				affiliateId: aff.id,
				amount: 100,
				method: "paypal",
			});
			await controller.createPayout({
				affiliateId: aff.id,
				amount: 100,
				method: "bank_transfer",
			});

			const all = await controller.listPayouts();
			expect(all).toHaveLength(2);
		});

		it("filters by affiliateId", async () => {
			const a1 = await controller.apply({
				name: "A",
				email: "a@example.com",
			});
			const a2 = await controller.apply({
				name: "B",
				email: "b@example.com",
			});
			await controller.approveAffiliate(a1.id, 10);
			await controller.approveAffiliate(a2.id, 10);
			const c1 = await controller.recordConversion({
				affiliateId: a1.id,
				orderId: "o-1",
				orderAmount: 1000,
			});
			const c2 = await controller.recordConversion({
				affiliateId: a2.id,
				orderId: "o-2",
				orderAmount: 1000,
			});
			await controller.approveConversion(unwrap(c1).id);
			await controller.approveConversion(unwrap(c2).id);
			await controller.createPayout({
				affiliateId: a1.id,
				amount: 50,
				method: "paypal",
			});
			await controller.createPayout({
				affiliateId: a2.id,
				amount: 50,
				method: "paypal",
			});

			const filtered = await controller.listPayouts({
				affiliateId: a1.id,
			});
			expect(filtered).toHaveLength(1);
		});

		it("filters by status", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const c = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "o-1",
				orderAmount: 5000,
			});
			await controller.approveConversion(unwrap(c).id);
			const p1 = await controller.createPayout({
				affiliateId: aff.id,
				amount: 100,
				method: "paypal",
			});
			await controller.createPayout({
				affiliateId: aff.id,
				amount: 100,
				method: "bank_transfer",
			});
			await controller.completePayout(unwrap(p1).id);

			const completed = await controller.listPayouts({
				status: "completed",
			});
			expect(completed).toHaveLength(1);

			const pending = await controller.listPayouts({
				status: "pending",
			});
			expect(pending).toHaveLength(1);
		});
	});

	describe("completePayout", () => {
		it("completes a pending payout and updates totalPaid", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const c = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "o-1",
				orderAmount: 1000,
			});
			await controller.approveConversion(unwrap(c).id);
			const payout = await controller.createPayout({
				affiliateId: aff.id,
				amount: 50,
				method: "paypal",
			});

			const completed = await controller.completePayout(unwrap(payout).id);
			expect(completed?.status).toBe("completed");
			expect(completed?.paidAt).toBeInstanceOf(Date);

			const updatedAff = await controller.getAffiliate(aff.id);
			expect(updatedAff?.totalPaid).toBe(50);
		});

		it("returns null for already completed payout", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const c = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "o-1",
				orderAmount: 1000,
			});
			await controller.approveConversion(unwrap(c).id);
			const payout = await controller.createPayout({
				affiliateId: aff.id,
				amount: 50,
				method: "paypal",
			});
			await controller.completePayout(unwrap(payout).id);
			const again = await controller.completePayout(unwrap(payout).id);
			expect(again).toBeNull();
		});

		it("returns null for non-existent payout", async () => {
			const result = await controller.completePayout("missing");
			expect(result).toBeNull();
		});
	});

	describe("failPayout", () => {
		it("fails a pending payout", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const c = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "o-1",
				orderAmount: 1000,
			});
			await controller.approveConversion(unwrap(c).id);
			const payout = await controller.createPayout({
				affiliateId: aff.id,
				amount: 50,
				method: "paypal",
			});

			const failed = await controller.failPayout(unwrap(payout).id);
			expect(failed?.status).toBe("failed");
		});

		it("returns null for completed payout", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const c = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "o-1",
				orderAmount: 1000,
			});
			await controller.approveConversion(unwrap(c).id);
			const payout = await controller.createPayout({
				affiliateId: aff.id,
				amount: 50,
				method: "paypal",
			});
			await controller.completePayout(unwrap(payout).id);
			const result = await controller.failPayout(unwrap(payout).id);
			expect(result).toBeNull();
		});
	});

	// ── Stats ─────────────────────────────────────────────────────────

	describe("getStats", () => {
		it("returns zeroes when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalAffiliates).toBe(0);
			expect(stats.activeAffiliates).toBe(0);
			expect(stats.pendingApplications).toBe(0);
			expect(stats.totalClicks).toBe(0);
			expect(stats.totalConversions).toBe(0);
			expect(stats.totalRevenue).toBe(0);
			expect(stats.totalCommission).toBe(0);
			expect(stats.totalPaid).toBe(0);
			expect(stats.conversionRate).toBe(0);
		});

		it("aggregates stats across affiliates", async () => {
			const a1 = await controller.apply({
				name: "A",
				email: "a@example.com",
			});
			const a2 = await controller.apply({
				name: "B",
				email: "b@example.com",
			});
			await controller.approveAffiliate(a1.id, 10);
			await controller.approveAffiliate(a2.id, 15);

			const l1 = await controller.createLink({
				affiliateId: a1.id,
				targetUrl: "https://store.com/1",
			});
			await controller.recordClick(unwrap(l1).id);
			await controller.recordClick(unwrap(l1).id);

			const c1 = await controller.recordConversion({
				affiliateId: a1.id,
				linkId: unwrap(l1).id,
				orderId: "o-1",
				orderAmount: 100,
			});
			await controller.approveConversion(unwrap(c1).id);

			const stats = await controller.getStats();
			expect(stats.totalAffiliates).toBe(2);
			expect(stats.activeAffiliates).toBe(2);
			expect(stats.pendingApplications).toBe(0);
			expect(stats.totalClicks).toBe(2);
			expect(stats.totalConversions).toBe(1);
			expect(stats.totalRevenue).toBe(100);
			expect(stats.totalCommission).toBe(10);
		});
	});

	describe("getAffiliateBalance", () => {
		it("returns balance for affiliate", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const c = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "o-1",
				orderAmount: 1000,
			});
			await controller.approveConversion(unwrap(c).id);

			const balance = await controller.getAffiliateBalance(aff.id);
			expect(balance.totalCommission).toBe(100);
			expect(balance.totalPaid).toBe(0);
			expect(balance.balance).toBe(100);
		});

		it("reflects paid amounts", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const c = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "o-1",
				orderAmount: 1000,
			});
			await controller.approveConversion(unwrap(c).id);
			const p = await controller.createPayout({
				affiliateId: aff.id,
				amount: 40,
				method: "paypal",
			});
			await controller.completePayout(unwrap(p).id);

			const balance = await controller.getAffiliateBalance(aff.id);
			expect(balance.totalCommission).toBe(100);
			expect(balance.totalPaid).toBe(40);
			expect(balance.balance).toBe(60);
		});

		it("returns zeroes for non-existent affiliate", async () => {
			const balance = await controller.getAffiliateBalance("missing");
			expect(balance.balance).toBe(0);
		});
	});

	// ── Full lifecycle ────────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("apply → approve → link → click → conversion → approve → payout → complete", async () => {
			// Apply
			const affiliate = await controller.apply({
				name: "Tech Blog",
				email: "tech@blog.com",
				website: "https://techblog.com",
			});
			expect(affiliate.status).toBe("pending");

			// Approve
			const approved = await controller.approveAffiliate(affiliate.id, 12);
			expect(approved?.status).toBe("approved");
			expect(approved?.commissionRate).toBe(12);

			// Create link
			const link = await controller.createLink({
				affiliateId: affiliate.id,
				targetUrl: "https://store.com/best-product",
			});
			expect(link?.slug).toHaveLength(10);

			// Record clicks
			await controller.recordClick(unwrap(link).id);
			await controller.recordClick(unwrap(link).id);
			await controller.recordClick(unwrap(link).id);

			// Record conversion
			const conversion = await controller.recordConversion({
				affiliateId: affiliate.id,
				linkId: unwrap(link).id,
				orderId: "order-123",
				orderAmount: 250,
			});
			expect(conversion?.commissionAmount).toBe(30);

			// Approve conversion
			await controller.approveConversion(unwrap(conversion).id);

			// Check balance
			const balance = await controller.getAffiliateBalance(affiliate.id);
			expect(balance.totalCommission).toBe(30);
			expect(balance.balance).toBe(30);

			// Create payout
			const payout = await controller.createPayout({
				affiliateId: affiliate.id,
				amount: 30,
				method: "bank_transfer",
				reference: "WIRE-001",
			});
			expect(payout?.status).toBe("pending");

			// Complete payout
			const completed = await controller.completePayout(unwrap(payout).id);
			expect(completed?.paidAt).toBeInstanceOf(Date);

			// Verify final state
			const finalAffiliate = await controller.getAffiliate(affiliate.id);
			expect(finalAffiliate?.totalClicks).toBe(3);
			expect(finalAffiliate?.totalConversions).toBe(1);
			expect(finalAffiliate?.totalRevenue).toBe(250);
			expect(finalAffiliate?.totalCommission).toBe(30);
			expect(finalAffiliate?.totalPaid).toBe(30);

			const finalBalance = await controller.getAffiliateBalance(affiliate.id);
			expect(finalBalance.balance).toBe(0);
		});

		it("suspended affiliate cannot create links or conversions", async () => {
			const aff = await controller.apply({
				name: "Bad Actor",
				email: "bad@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			await controller.suspendAffiliate(aff.id);

			const link = await controller.createLink({
				affiliateId: aff.id,
				targetUrl: "https://store.com",
			});
			expect(link).toBeNull();

			const conversion = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "o-1",
				orderAmount: 100,
			});
			expect(conversion).toBeNull();
		});

		it("rejected affiliate cannot be approved again", async () => {
			const aff = await controller.apply({
				name: "Rejected",
				email: "rejected@example.com",
			});
			await controller.rejectAffiliate(aff.id);
			const result = await controller.approveAffiliate(aff.id);
			expect(result).toBeNull();
		});
	});
});
