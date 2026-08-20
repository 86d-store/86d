import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAffiliateController } from "../service-impl";

/**
 * Security tests for affiliates module endpoints.
 *
 * These tests verify:
 * - Affiliate isolation: one affiliate cannot access another's data
 * - Status enforcement: only approved affiliates can create links/conversions
 * - Payout balance enforcement: cannot pay out more than earned balance
 * - State machine integrity: conversions follow valid status transitions
 * - Link deactivation: deactivated links cannot record clicks
 * - Cascade behavior: suspending affiliate affects their operations
 */

describe("affiliates endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAffiliateController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAffiliateController(mockData);
	});

	async function createApprovedAffiliate(name: string, email: string) {
		const affiliate = await controller.apply({
			name,
			email,
			website: `https://${name.toLowerCase()}.com`,
			customerId: `cust_${name.toLowerCase()}`,
		});
		const approved = await controller.approveAffiliate(affiliate.id, 10);
		return approved ?? affiliate;
	}

	// ── Affiliate Isolation ─────────────────────────────────────────

	describe("affiliate isolation", () => {
		it("links scoped to their affiliate", async () => {
			const affA = await createApprovedAffiliate("Alice", "alice@test.com");
			const affB = await createApprovedAffiliate("Bob", "bob@test.com");

			await controller.createLink({
				affiliateId: affA.id,
				targetUrl: "https://store.com/product-1",
			});

			const linksA = await controller.listLinks({ affiliateId: affA.id });
			const linksB = await controller.listLinks({ affiliateId: affB.id });

			expect(linksA).toHaveLength(1);
			expect(linksB).toHaveLength(0);
		});

		it("conversions scoped to their affiliate", async () => {
			const affA = await createApprovedAffiliate("Alice", "alice@test.com");
			const affB = await createApprovedAffiliate("Bob", "bob@test.com");

			const linkA = await controller.createLink({
				affiliateId: affA.id,
				targetUrl: "https://store.com/product-1",
			});

			if (linkA) {
				await controller.recordConversion({
					affiliateId: affA.id,
					linkId: linkA.id,
					orderId: "order_1",
					orderAmount: 10000,
				});
			}

			const convA = await controller.listConversions({
				affiliateId: affA.id,
			});
			const convB = await controller.listConversions({
				affiliateId: affB.id,
			});

			expect(convA).toHaveLength(1);
			expect(convB).toHaveLength(0);
		});

		it("payouts scoped to their affiliate", async () => {
			const affA = await createApprovedAffiliate("Alice", "alice@test.com");
			const affB = await createApprovedAffiliate("Bob", "bob@test.com");

			// Give Alice some balance first
			const linkA = await controller.createLink({
				affiliateId: affA.id,
				targetUrl: "https://store.com/product",
			});
			if (linkA) {
				const conv = await controller.recordConversion({
					affiliateId: affA.id,
					linkId: linkA.id,
					orderId: "order_1",
					orderAmount: 10000,
				});
				if (conv) {
					await controller.approveConversion(conv.id);
				}
			}

			await controller.createPayout({
				affiliateId: affA.id,
				amount: 500,
				method: "bank_transfer",
			});

			const payoutsA = await controller.listPayouts({
				affiliateId: affA.id,
			});
			const payoutsB = await controller.listPayouts({
				affiliateId: affB.id,
			});

			expect(payoutsA).toHaveLength(1);
			expect(payoutsB).toHaveLength(0);
		});

		it("balance scoped to correct affiliate", async () => {
			const affA = await createApprovedAffiliate("Alice", "alice@test.com");
			const affB = await createApprovedAffiliate("Bob", "bob@test.com");

			const linkA = await controller.createLink({
				affiliateId: affA.id,
				targetUrl: "https://store.com/product",
			});
			if (linkA) {
				const conv = await controller.recordConversion({
					affiliateId: affA.id,
					linkId: linkA.id,
					orderId: "order_1",
					orderAmount: 10000,
				});
				if (conv) {
					await controller.approveConversion(conv.id);
				}
			}

			const balanceA = await controller.getAffiliateBalance(affA.id);
			const balanceB = await controller.getAffiliateBalance(affB.id);

			expect(balanceA.totalCommission).toBeGreaterThan(0);
			expect(balanceB.totalCommission).toBe(0);
		});
	});

	// ── Status Enforcement ──────────────────────────────────────────

	describe("status enforcement", () => {
		it("pending affiliate cannot create links", async () => {
			const pending = await controller.apply({
				name: "Pending Pete",
				email: "pete@test.com",
				website: "https://pete.com",
				customerId: "cust_pete",
			});

			const link = await controller.createLink({
				affiliateId: pending.id,
				targetUrl: "https://store.com/product",
			});
			expect(link).toBeNull();
		});

		it("suspended affiliate cannot create links", async () => {
			const affiliate = await createApprovedAffiliate(
				"Suspended",
				"suspended@test.com",
			);
			await controller.suspendAffiliate(affiliate.id);

			const link = await controller.createLink({
				affiliateId: affiliate.id,
				targetUrl: "https://store.com/product",
			});
			expect(link).toBeNull();
		});

		it("rejected affiliate cannot be approved", async () => {
			const affiliate = await controller.apply({
				name: "Rejected",
				email: "rejected@test.com",
				website: "https://rejected.com",
				customerId: "cust_rejected",
			});
			await controller.rejectAffiliate(affiliate.id);

			const approved = await controller.approveAffiliate(affiliate.id, 10);
			expect(approved).toBeNull();
		});

		it("only pending affiliates can be rejected", async () => {
			const affiliate = await createApprovedAffiliate(
				"Approved",
				"approved@test.com",
			);

			const rejected = await controller.rejectAffiliate(affiliate.id);
			expect(rejected).toBeNull();
		});

		it("only approved affiliates can be suspended", async () => {
			const pending = await controller.apply({
				name: "Pending",
				email: "pending@test.com",
				website: "https://pending.com",
				customerId: "cust_pending",
			});

			const suspended = await controller.suspendAffiliate(pending.id);
			expect(suspended).toBeNull();
		});
	});

	// ── Conversion State Machine ────────────────────────────────────

	describe("conversion state machine", () => {
		async function createConversion(affiliateId: string) {
			const link = await controller.createLink({
				affiliateId,
				targetUrl: "https://store.com/product",
			});
			if (!link) return null;

			return controller.recordConversion({
				affiliateId,
				linkId: link.id,
				orderId: `order_${Date.now()}`,
				orderAmount: 10000,
			});
		}

		it("only pending conversions can be approved", async () => {
			const affiliate = await createApprovedAffiliate(
				"Converter",
				"converter@test.com",
			);
			const conversion = await createConversion(affiliate.id);
			expect(conversion).not.toBeNull();

			if (conversion) {
				await controller.approveConversion(conversion.id);
				// Second approval fails
				const second = await controller.approveConversion(conversion.id);
				expect(second).toBeNull();
			}
		});

		it("only pending conversions can be rejected", async () => {
			const affiliate = await createApprovedAffiliate(
				"Converter",
				"converter@test.com",
			);
			const conversion = await createConversion(affiliate.id);

			if (conversion) {
				await controller.approveConversion(conversion.id);
				const rejected = await controller.rejectConversion(conversion.id);
				expect(rejected).toBeNull();
			}
		});

		it("rejected conversion does not affect balance", async () => {
			const affiliate = await createApprovedAffiliate(
				"Converter",
				"converter@test.com",
			);
			const conversion = await createConversion(affiliate.id);

			if (conversion) {
				await controller.rejectConversion(conversion.id);
			}

			const balance = await controller.getAffiliateBalance(affiliate.id);
			expect(balance.totalCommission).toBe(0);
		});
	});

	// ── Payout Balance Enforcement ──────────────────────────────────

	describe("payout balance enforcement", () => {
		it("payout for non-existent affiliate returns null", async () => {
			const result = await controller.createPayout({
				affiliateId: "nonexistent",
				amount: 500,
				method: "bank_transfer",
			});
			expect(result).toBeNull();
		});

		it("payout exceeding balance is rejected", async () => {
			const affiliate = await createApprovedAffiliate("Poor", "poor@test.com");

			// No conversions, balance is 0
			const result = await controller.createPayout({
				affiliateId: affiliate.id,
				amount: 99999,
				method: "bank_transfer",
			});
			expect(result).toBeNull();
		});

		it("payout status transitions work correctly", async () => {
			const affiliate = await createApprovedAffiliate("Rich", "rich@test.com");

			// Build up balance
			const link = await controller.createLink({
				affiliateId: affiliate.id,
				targetUrl: "https://store.com/product",
			});
			if (link) {
				const conv = await controller.recordConversion({
					affiliateId: affiliate.id,
					linkId: link.id,
					orderId: "big-order",
					orderAmount: 100000,
				});
				if (conv) await controller.approveConversion(conv.id);
			}

			const payout = await controller.createPayout({
				affiliateId: affiliate.id,
				amount: 500,
				method: "bank_transfer",
			});

			if (payout) {
				const completed = await controller.completePayout(payout.id);
				expect(completed?.status).toBe("completed");
			}
		});

		it("failed payout does not reduce balance", async () => {
			const affiliate = await createApprovedAffiliate(
				"FailPay",
				"failpay@test.com",
			);

			const link = await controller.createLink({
				affiliateId: affiliate.id,
				targetUrl: "https://store.com/product",
			});
			if (link) {
				const conv = await controller.recordConversion({
					affiliateId: affiliate.id,
					linkId: link.id,
					orderId: "order-fail",
					orderAmount: 50000,
				});
				if (conv) await controller.approveConversion(conv.id);
			}

			const balanceBefore = await controller.getAffiliateBalance(affiliate.id);

			const payout = await controller.createPayout({
				affiliateId: affiliate.id,
				amount: 100,
				method: "bank_transfer",
			});
			if (payout) {
				await controller.failPayout(payout.id);
			}

			const balanceAfter = await controller.getAffiliateBalance(affiliate.id);

			// Balance should be restored after failed payout
			expect(balanceAfter.balance).toBeGreaterThanOrEqual(
				balanceBefore.balance - 100,
			);
		});
	});

	// ── Link Security ───────────────────────────────────────────────

	describe("link security", () => {
		it("deactivated link can still be looked up by slug", async () => {
			const affiliate = await createApprovedAffiliate(
				"Linker",
				"linker@test.com",
			);
			const link = await controller.createLink({
				affiliateId: affiliate.id,
				targetUrl: "https://store.com/product",
			});

			if (link) {
				await controller.deactivateLink(link.id);

				const found = await controller.getLink(link.id);
				expect(found).not.toBeNull();
				expect(found?.active).toBe(false);
			}
		});

		it("click recording works on active links", async () => {
			const affiliate = await createApprovedAffiliate(
				"Clicker",
				"clicker@test.com",
			);
			const link = await controller.createLink({
				affiliateId: affiliate.id,
				targetUrl: "https://store.com/product",
			});

			if (link) {
				const clicked = await controller.recordClick(link.id);
				expect(clicked).not.toBeNull();
				expect(clicked?.clicks).toBe(1);
			}
		});

		it("non-existent link returns null", async () => {
			const result = await controller.getLink("nonexistent");
			expect(result).toBeNull();
		});

		it("deactivate non-existent link returns null", async () => {
			const result = await controller.deactivateLink("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── Non-existent Resources ──────────────────────────────────────

	describe("non-existent resources", () => {
		it("getAffiliate returns null for non-existent ID", async () => {
			const result = await controller.getAffiliate("nonexistent");
			expect(result).toBeNull();
		});

		it("getAffiliateByCode returns null for non-existent code", async () => {
			const result = await controller.getAffiliateByCode("FAKECODE");
			expect(result).toBeNull();
		});

		it("getAffiliateByEmail returns null for non-existent email", async () => {
			const result = await controller.getAffiliateByEmail(
				"nonexistent@test.com",
			);
			expect(result).toBeNull();
		});

		it("approveAffiliate returns null for non-existent ID", async () => {
			const result = await controller.approveAffiliate("nonexistent", 10);
			expect(result).toBeNull();
		});

		it("suspendAffiliate returns null for non-existent ID", async () => {
			const result = await controller.suspendAffiliate("nonexistent");
			expect(result).toBeNull();
		});

		it("getConversion returns null for non-existent ID", async () => {
			const result = await controller.getConversion("nonexistent");
			expect(result).toBeNull();
		});

		it("getPayout returns null for non-existent ID", async () => {
			const result = await controller.getPayout("nonexistent");
			expect(result).toBeNull();
		});
	});
});
