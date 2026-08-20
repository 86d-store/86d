import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAffiliateController } from "../service-impl";

function unwrap<T>(value: T | null | undefined): T {
	expect(value).not.toBeNull();
	return value as T;
}

describe("affiliate controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAffiliateController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAffiliateController(mockData);
	});

	// ── Payout balance edge cases ────────────────────────────────────

	describe("payout balance edge cases", () => {
		it("payout exactly equal to remaining balance succeeds", async () => {
			const aff = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			await controller.approveAffiliate(aff.id, 20);
			const c = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "o-1",
				orderAmount: 500,
			});
			await controller.approveConversion(unwrap(c).id);

			// Commission = 500 * 0.20 = 100
			const balance = await controller.getAffiliateBalance(aff.id);
			expect(balance.balance).toBe(100);

			const payout = await controller.createPayout({
				affiliateId: aff.id,
				amount: 100,
				method: "paypal",
			});
			expect(payout).not.toBeNull();
			expect(payout?.amount).toBe(100);

			await controller.completePayout(unwrap(payout).id);
			const finalBalance = await controller.getAffiliateBalance(aff.id);
			expect(finalBalance.balance).toBe(0);
			expect(finalBalance.totalPaid).toBe(100);
		});

		it("multiple payouts reduce balance incrementally", async () => {
			const aff = await controller.apply({
				name: "Bob",
				email: "bob@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const c = await controller.recordConversion({
				affiliateId: aff.id,
				orderId: "o-1",
				orderAmount: 1000,
			});
			await controller.approveConversion(unwrap(c).id);

			// Commission = 1000 * 0.10 = 100
			// Pay 30, then 30, then 30, then try 20 (should fail, only 10 left)
			const p1 = await controller.createPayout({
				affiliateId: aff.id,
				amount: 30,
				method: "bank_transfer",
			});
			await controller.completePayout(unwrap(p1).id);

			const b1 = await controller.getAffiliateBalance(aff.id);
			expect(b1.balance).toBe(70);

			const p2 = await controller.createPayout({
				affiliateId: aff.id,
				amount: 30,
				method: "bank_transfer",
			});
			await controller.completePayout(unwrap(p2).id);

			const b2 = await controller.getAffiliateBalance(aff.id);
			expect(b2.balance).toBe(40);

			const p3 = await controller.createPayout({
				affiliateId: aff.id,
				amount: 30,
				method: "bank_transfer",
			});
			await controller.completePayout(unwrap(p3).id);

			const b3 = await controller.getAffiliateBalance(aff.id);
			expect(b3.balance).toBe(10);

			// Exceeds remaining balance
			const p4 = await controller.createPayout({
				affiliateId: aff.id,
				amount: 20,
				method: "bank_transfer",
			});
			expect(p4).toBeNull();

			// Exact remaining balance should work
			const p5 = await controller.createPayout({
				affiliateId: aff.id,
				amount: 10,
				method: "bank_transfer",
			});
			expect(p5).not.toBeNull();
		});
	});

	// ── Concurrent affiliates ────────────────────────────────────────

	describe("concurrent affiliates with different commission rates", () => {
		it("stats are isolated per affiliate", async () => {
			const alice = await controller.apply({
				name: "Alice",
				email: "alice@example.com",
			});
			const bob = await controller.apply({
				name: "Bob",
				email: "bob@example.com",
			});
			await controller.approveAffiliate(alice.id, 5);
			await controller.approveAffiliate(bob.id, 25);

			const aliceLink = unwrap(
				await controller.createLink({
					affiliateId: alice.id,
					targetUrl: "https://store.com/a",
				}),
			);
			const bobLink = unwrap(
				await controller.createLink({
					affiliateId: bob.id,
					targetUrl: "https://store.com/b",
				}),
			);

			// Alice gets 5 clicks, Bob gets 2
			for (let i = 0; i < 5; i++) {
				await controller.recordClick(aliceLink.id);
			}
			for (let i = 0; i < 2; i++) {
				await controller.recordClick(bobLink.id);
			}

			// Alice converts $200, Bob converts $400
			const ca = unwrap(
				await controller.recordConversion({
					affiliateId: alice.id,
					linkId: aliceLink.id,
					orderId: "oa-1",
					orderAmount: 200,
				}),
			);
			const cb = unwrap(
				await controller.recordConversion({
					affiliateId: bob.id,
					linkId: bobLink.id,
					orderId: "ob-1",
					orderAmount: 400,
				}),
			);
			await controller.approveConversion(ca.id);
			await controller.approveConversion(cb.id);

			// Alice: 5% of 200 = 10, Bob: 25% of 400 = 100
			const aliceAff = unwrap(await controller.getAffiliate(alice.id));
			expect(aliceAff.totalClicks).toBe(5);
			expect(aliceAff.totalConversions).toBe(1);
			expect(aliceAff.totalRevenue).toBe(200);
			expect(aliceAff.totalCommission).toBe(10);

			const bobAff = unwrap(await controller.getAffiliate(bob.id));
			expect(bobAff.totalClicks).toBe(2);
			expect(bobAff.totalConversions).toBe(1);
			expect(bobAff.totalRevenue).toBe(400);
			expect(bobAff.totalCommission).toBe(100);

			// Global stats should aggregate both
			const stats = await controller.getStats();
			expect(stats.totalClicks).toBe(7);
			expect(stats.totalConversions).toBe(2);
			expect(stats.totalRevenue).toBe(600);
			expect(stats.totalCommission).toBe(110);
			expect(stats.activeAffiliates).toBe(2);
		});
	});

	// ── Multiple conversions per link ────────────────────────────────

	describe("multiple conversions per link", () => {
		it("link revenue accumulates across multiple conversions", async () => {
			const aff = await controller.apply({
				name: "Charlie",
				email: "charlie@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const link = unwrap(
				await controller.createLink({
					affiliateId: aff.id,
					targetUrl: "https://store.com/product",
				}),
			);

			// Three conversions on the same link with different amounts
			await controller.recordConversion({
				affiliateId: aff.id,
				linkId: link.id,
				orderId: "o-1",
				orderAmount: 100,
			});
			await controller.recordConversion({
				affiliateId: aff.id,
				linkId: link.id,
				orderId: "o-2",
				orderAmount: 250,
			});
			await controller.recordConversion({
				affiliateId: aff.id,
				linkId: link.id,
				orderId: "o-3",
				orderAmount: 50,
			});

			const updatedLink = unwrap(await controller.getLink(link.id));
			expect(updatedLink.conversions).toBe(3);
			expect(updatedLink.revenue).toBe(400);
		});

		it("approved and rejected conversions both count in link stats", async () => {
			const aff = await controller.apply({
				name: "Dave",
				email: "dave@example.com",
			});
			await controller.approveAffiliate(aff.id, 15);
			const link = unwrap(
				await controller.createLink({
					affiliateId: aff.id,
					targetUrl: "https://store.com/item",
				}),
			);

			const c1 = unwrap(
				await controller.recordConversion({
					affiliateId: aff.id,
					linkId: link.id,
					orderId: "o-1",
					orderAmount: 200,
				}),
			);
			const c2 = unwrap(
				await controller.recordConversion({
					affiliateId: aff.id,
					linkId: link.id,
					orderId: "o-2",
					orderAmount: 300,
				}),
			);

			await controller.approveConversion(c1.id);
			await controller.rejectConversion(c2.id);

			// Link stats track all conversions regardless of approval
			const updatedLink = unwrap(await controller.getLink(link.id));
			expect(updatedLink.conversions).toBe(2);
			expect(updatedLink.revenue).toBe(500);

			// But affiliate totals only count approved conversions
			const affData = unwrap(await controller.getAffiliate(aff.id));
			expect(affData.totalConversions).toBe(1);
			expect(affData.totalRevenue).toBe(200);
			expect(affData.totalCommission).toBe(30); // 15% of 200
		});
	});

	// ── Failed payouts don't affect balance ──────────────────────────

	describe("failed payouts don't affect balance", () => {
		it("failing a payout does not reduce affiliate balance", async () => {
			const aff = await controller.apply({
				name: "Eve",
				email: "eve@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);
			const c = unwrap(
				await controller.recordConversion({
					affiliateId: aff.id,
					orderId: "o-1",
					orderAmount: 500,
				}),
			);
			await controller.approveConversion(c.id);

			// Balance should be 50
			const before = await controller.getAffiliateBalance(aff.id);
			expect(before.balance).toBe(50);

			const payout = unwrap(
				await controller.createPayout({
					affiliateId: aff.id,
					amount: 50,
					method: "paypal",
				}),
			);
			await controller.failPayout(payout.id);

			// Balance should still be 50 since payout was not completed
			const after = await controller.getAffiliateBalance(aff.id);
			expect(after.balance).toBe(50);
			expect(after.totalPaid).toBe(0);
		});

		it("can create a new payout after a previous one failed", async () => {
			const aff = await controller.apply({
				name: "Frank",
				email: "frank@example.com",
			});
			await controller.approveAffiliate(aff.id, 20);
			const c = unwrap(
				await controller.recordConversion({
					affiliateId: aff.id,
					orderId: "o-1",
					orderAmount: 300,
				}),
			);
			await controller.approveConversion(c.id);

			// Commission = 60
			const p1 = unwrap(
				await controller.createPayout({
					affiliateId: aff.id,
					amount: 60,
					method: "bank_transfer",
				}),
			);
			await controller.failPayout(p1.id);

			// Should be able to create another payout for same amount
			const p2 = await controller.createPayout({
				affiliateId: aff.id,
				amount: 60,
				method: "paypal",
			});
			expect(p2).not.toBeNull();

			await controller.completePayout(unwrap(p2).id);
			const finalBalance = await controller.getAffiliateBalance(aff.id);
			expect(finalBalance.balance).toBe(0);
			expect(finalBalance.totalPaid).toBe(60);
		});
	});

	// ── Full lifecycle with multiple links ───────────────────────────

	describe("full lifecycle with multiple links", () => {
		it("single affiliate with multiple links tracks independently", async () => {
			const aff = await controller.apply({
				name: "Grace",
				email: "grace@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);

			const linkA = unwrap(
				await controller.createLink({
					affiliateId: aff.id,
					targetUrl: "https://store.com/shoes",
				}),
			);
			const linkB = unwrap(
				await controller.createLink({
					affiliateId: aff.id,
					targetUrl: "https://store.com/hats",
				}),
			);
			const linkC = unwrap(
				await controller.createLink({
					affiliateId: aff.id,
					targetUrl: "https://store.com/bags",
				}),
			);

			// Different click counts per link
			await controller.recordClick(linkA.id);
			await controller.recordClick(linkA.id);
			await controller.recordClick(linkA.id);
			await controller.recordClick(linkB.id);
			// linkC gets no clicks

			// Conversions on two of the three links
			await controller.recordConversion({
				affiliateId: aff.id,
				linkId: linkA.id,
				orderId: "o-1",
				orderAmount: 100,
			});
			await controller.recordConversion({
				affiliateId: aff.id,
				linkId: linkA.id,
				orderId: "o-2",
				orderAmount: 150,
			});
			await controller.recordConversion({
				affiliateId: aff.id,
				linkId: linkB.id,
				orderId: "o-3",
				orderAmount: 80,
			});

			// Verify each link's stats independently
			const updA = unwrap(await controller.getLink(linkA.id));
			expect(updA.clicks).toBe(3);
			expect(updA.conversions).toBe(2);
			expect(updA.revenue).toBe(250);

			const updB = unwrap(await controller.getLink(linkB.id));
			expect(updB.clicks).toBe(1);
			expect(updB.conversions).toBe(1);
			expect(updB.revenue).toBe(80);

			const updC = unwrap(await controller.getLink(linkC.id));
			expect(updC.clicks).toBe(0);
			expect(updC.conversions).toBe(0);
			expect(updC.revenue).toBe(0);

			// Affiliate-level clicks should be aggregate
			const affData = unwrap(await controller.getAffiliate(aff.id));
			expect(affData.totalClicks).toBe(4);
		});
	});

	// ── Update preserves stats ───────────────────────────────────────

	describe("update preserves stats", () => {
		it("updating name and email does not reset counters", async () => {
			const aff = await controller.apply({
				name: "Hank",
				email: "hank@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);

			const link = unwrap(
				await controller.createLink({
					affiliateId: aff.id,
					targetUrl: "https://store.com/x",
				}),
			);
			await controller.recordClick(link.id);
			await controller.recordClick(link.id);

			const c = unwrap(
				await controller.recordConversion({
					affiliateId: aff.id,
					linkId: link.id,
					orderId: "o-1",
					orderAmount: 400,
				}),
			);
			await controller.approveConversion(c.id);

			// Now update the affiliate's profile
			const updated = unwrap(
				await controller.updateAffiliate(aff.id, {
					name: "Hank Updated",
					email: "hank.new@example.com",
					website: "https://hank.dev",
					notes: "Top performer",
				}),
			);

			expect(updated.name).toBe("Hank Updated");
			expect(updated.email).toBe("hank.new@example.com");
			expect(updated.website).toBe("https://hank.dev");
			expect(updated.notes).toBe("Top performer");

			// All counters preserved
			expect(updated.totalClicks).toBe(2);
			expect(updated.totalConversions).toBe(1);
			expect(updated.totalRevenue).toBe(400);
			expect(updated.totalCommission).toBe(40);
			expect(updated.totalPaid).toBe(0);
			expect(updated.status).toBe("approved");
			expect(updated.commissionRate).toBe(10);
		});

		it("updating commission rate does not affect existing totals", async () => {
			const aff = await controller.apply({
				name: "Ivy",
				email: "ivy@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);

			const c = unwrap(
				await controller.recordConversion({
					affiliateId: aff.id,
					orderId: "o-1",
					orderAmount: 1000,
				}),
			);
			await controller.approveConversion(c.id);

			// totalCommission = 100 (10% of 1000)
			await controller.updateAffiliate(aff.id, { commissionRate: 50 });

			const affData = unwrap(await controller.getAffiliate(aff.id));
			expect(affData.commissionRate).toBe(50);
			// Previous commission is NOT retroactively changed
			expect(affData.totalCommission).toBe(100);
		});
	});

	// ── Deactivated link isolation ───────────────────────────────────

	describe("deactivated link isolation", () => {
		it("deactivating one link does not affect other links", async () => {
			const aff = await controller.apply({
				name: "Jack",
				email: "jack@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);

			const linkA = unwrap(
				await controller.createLink({
					affiliateId: aff.id,
					targetUrl: "https://store.com/a",
				}),
			);
			const linkB = unwrap(
				await controller.createLink({
					affiliateId: aff.id,
					targetUrl: "https://store.com/b",
				}),
			);

			// Click both links
			await controller.recordClick(linkA.id);
			await controller.recordClick(linkB.id);

			// Deactivate linkA
			await controller.deactivateLink(linkA.id);

			// linkA should reject clicks
			const clickResult = await controller.recordClick(linkA.id);
			expect(clickResult).toBeNull();

			// linkB should still accept clicks
			const clickB = await controller.recordClick(linkB.id);
			expect(clickB).not.toBeNull();
			expect(clickB?.clicks).toBe(2);

			// Verify link states
			const a = unwrap(await controller.getLink(linkA.id));
			expect(a.active).toBe(false);
			expect(a.clicks).toBe(1); // preserved from before deactivation

			const b = unwrap(await controller.getLink(linkB.id));
			expect(b.active).toBe(true);
			expect(b.clicks).toBe(2);
		});

		it("conversions can still reference a deactivated link", async () => {
			const aff = await controller.apply({
				name: "Karen",
				email: "karen@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);

			const link = unwrap(
				await controller.createLink({
					affiliateId: aff.id,
					targetUrl: "https://store.com/product",
				}),
			);

			// Record a conversion on the link, then deactivate
			await controller.recordConversion({
				affiliateId: aff.id,
				linkId: link.id,
				orderId: "o-1",
				orderAmount: 200,
			});
			await controller.deactivateLink(link.id);

			// Recording a new conversion referencing the deactivated link
			// still updates the link's stats (conversion != click)
			const c2 = await controller.recordConversion({
				affiliateId: aff.id,
				linkId: link.id,
				orderId: "o-2",
				orderAmount: 300,
			});
			expect(c2).not.toBeNull();

			const updatedLink = unwrap(await controller.getLink(link.id));
			expect(updatedLink.conversions).toBe(2);
			expect(updatedLink.revenue).toBe(500);
		});
	});

	// ── Commission rate at approval time ─────────────────────────────

	describe("commission rate at conversion time", () => {
		it("commission is locked at affiliate rate at time of conversion", async () => {
			const aff = await controller.apply({
				name: "Leo",
				email: "leo@example.com",
			});
			await controller.approveAffiliate(aff.id, 10);

			// Conversion at 10% rate
			const c1 = unwrap(
				await controller.recordConversion({
					affiliateId: aff.id,
					orderId: "o-1",
					orderAmount: 1000,
				}),
			);
			expect(c1.commissionRate).toBe(10);
			expect(c1.commissionAmount).toBe(100);

			// Change commission rate to 25%
			await controller.updateAffiliate(aff.id, { commissionRate: 25 });

			// Conversion at new 25% rate
			const c2 = unwrap(
				await controller.recordConversion({
					affiliateId: aff.id,
					orderId: "o-2",
					orderAmount: 1000,
				}),
			);
			expect(c2.commissionRate).toBe(25);
			expect(c2.commissionAmount).toBe(250);

			// Original conversion is unchanged
			const c1Again = unwrap(await controller.getConversion(c1.id));
			expect(c1Again.commissionRate).toBe(10);
			expect(c1Again.commissionAmount).toBe(100);
		});

		it("approved conversion totals reflect rate at time of each conversion", async () => {
			const aff = await controller.apply({
				name: "Mia",
				email: "mia@example.com",
			});
			await controller.approveAffiliate(aff.id, 5);

			// First conversion at 5%
			const c1 = unwrap(
				await controller.recordConversion({
					affiliateId: aff.id,
					orderId: "o-1",
					orderAmount: 200,
				}),
			);
			await controller.approveConversion(c1.id);

			// Change rate to 20%
			await controller.updateAffiliate(aff.id, { commissionRate: 20 });

			// Second conversion at 20%
			const c2 = unwrap(
				await controller.recordConversion({
					affiliateId: aff.id,
					orderId: "o-2",
					orderAmount: 200,
				}),
			);
			await controller.approveConversion(c2.id);

			// totalCommission = 10 (5% of 200) + 40 (20% of 200) = 50
			const affData = unwrap(await controller.getAffiliate(aff.id));
			expect(affData.totalCommission).toBe(50);
			expect(affData.totalRevenue).toBe(400);
			expect(affData.totalConversions).toBe(2);

			const balance = await controller.getAffiliateBalance(aff.id);
			expect(balance.balance).toBe(50);
		});
	});
});
