import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createReferralController } from "../service-impl";

/**
 * Security tests for referrals module endpoints.
 *
 * These tests verify:
 * - Referral code uniqueness: each customer gets a distinct code
 * - Self-referral prevention: owner of a code cannot use it
 * - Reward isolation: rewards scoped per referrer, not shared
 * - Status transition enforcement: only valid transitions allowed
 * - Duplicate referral prevention: maxUses and deactivation guards
 * - Expired code rejection: codes past expiry cannot be used
 * - Reward rule isolation: deleted/deactivated rules don't leak
 * - Stats isolation: per-customer stats don't bleed across accounts
 */

describe("referrals endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createReferralController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createReferralController(mockData);
	});

	// ── Self-Referral Prevention ───────────────────────────────────

	describe("self-referral prevention", () => {
		it("rejects referral where referee is the code owner", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			const result = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_a",
				refereeEmail: "self@example.com",
			});
			expect(result).toBeNull();
		});

		it("allows referral when referee differs from owner", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			const result = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "other@example.com",
			});
			expect(result).not.toBeNull();
			expect(result?.referrerCustomerId).toBe("customer_a");
			expect(result?.refereeCustomerId).toBe("customer_b");
		});
	});

	// ── Referral Code Uniqueness ──────────────────────────────────

	describe("referral code uniqueness", () => {
		it("generates distinct codes for different customers", async () => {
			const codeA = await controller.createCode({
				customerId: "customer_a",
			});
			const codeB = await controller.createCode({
				customerId: "customer_b",
			});
			const codeC = await controller.createCode({
				customerId: "customer_c",
			});

			const codes = new Set([codeA.code, codeB.code, codeC.code]);
			expect(codes.size).toBe(3);
		});

		it("each code has exactly 8 characters", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			expect(code.code).toHaveLength(8);
		});

		it("codes are retrievable by their string value", async () => {
			const created = await controller.createCode({
				customerId: "customer_a",
			});
			const found = await controller.getCodeByCode(created.code);
			expect(found?.id).toBe(created.id);
			expect(found?.customerId).toBe("customer_a");
		});
	});

	// ── Deactivated Code Enforcement ──────────────────────────────

	describe("deactivated code enforcement", () => {
		it("deactivated code cannot be used for referrals", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			await controller.deactivateCode(code.id);

			const result = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});
			expect(result).toBeNull();
		});

		it("deactivation of one code does not affect another", async () => {
			const codeA = await controller.createCode({
				customerId: "customer_a",
			});
			const codeB = await controller.createCode({
				customerId: "customer_b",
			});
			await controller.deactivateCode(codeA.id);

			const result = await controller.createReferral({
				referralCodeId: codeB.id,
				refereeCustomerId: "customer_c",
				refereeEmail: "c@example.com",
			});
			expect(result).not.toBeNull();
			expect(result?.referrerCustomerId).toBe("customer_b");
		});
	});

	// ── Max Uses Enforcement ──────────────────────────────────────

	describe("max uses enforcement", () => {
		it("code with maxUses=1 rejects second referral", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
				maxUses: 1,
			});

			const first = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});
			expect(first).not.toBeNull();

			const second = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_c",
				refereeEmail: "c@example.com",
			});
			expect(second).toBeNull();
		});

		it("code with maxUses=0 allows unlimited referrals", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
				maxUses: 0,
			});

			for (let i = 1; i <= 5; i++) {
				const ref = await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: `referee_${i}`,
					refereeEmail: `r${i}@example.com`,
				});
				expect(ref).not.toBeNull();
			}

			const updated = await controller.getCode(code.id);
			expect(updated?.usageCount).toBe(5);
		});
	});

	// ── Expired Code Rejection ────────────────────────────────────

	describe("expired code rejection", () => {
		it("expired code cannot produce a referral", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
				expiresAt: new Date("2020-01-01"),
			});

			const result = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});
			expect(result).toBeNull();
		});
	});

	// ── Status Transition Enforcement ─────────────────────────────

	describe("status transition enforcement", () => {
		it("only pending referrals can be completed", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});
			// Complete it once
			await controller.completeReferral(ref?.id ?? "");
			// Second completion must fail
			const again = await controller.completeReferral(ref?.id ?? "");
			expect(again).toBeNull();
		});

		it("only pending referrals can be revoked", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});
			await controller.completeReferral(ref?.id ?? "");

			const result = await controller.revokeReferral(ref?.id ?? "");
			expect(result).toBeNull();
		});

		it("revoked referral cannot be completed", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});
			await controller.revokeReferral(ref?.id ?? "");

			const result = await controller.completeReferral(ref?.id ?? "");
			expect(result).toBeNull();
		});

		it("revoked referral cannot be revoked again", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});
			await controller.revokeReferral(ref?.id ?? "");

			const result = await controller.revokeReferral(ref?.id ?? "");
			expect(result).toBeNull();
		});
	});

	// ── Reward Isolation per Referrer ─────────────────────────────

	describe("reward isolation per referrer", () => {
		it("marking referrer rewarded does not affect referee flag", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});

			await controller.markReferrerRewarded(ref?.id ?? "");
			const after = await controller.getReferral(ref?.id ?? "");
			expect(after?.referrerRewarded).toBe(true);
			expect(after?.refereeRewarded).toBe(false);
		});

		it("marking referee rewarded does not affect referrer flag", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});

			await controller.markRefereeRewarded(ref?.id ?? "");
			const after = await controller.getReferral(ref?.id ?? "");
			expect(after?.referrerRewarded).toBe(false);
			expect(after?.refereeRewarded).toBe(true);
		});

		it("rewards on one referral do not leak to another", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			const refB = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});
			const refC = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_c",
				refereeEmail: "c@example.com",
			});

			await controller.markReferrerRewarded(refB?.id ?? "");
			await controller.markRefereeRewarded(refB?.id ?? "");

			const otherRef = await controller.getReferral(refC?.id ?? "");
			expect(otherRef?.referrerRewarded).toBe(false);
			expect(otherRef?.refereeRewarded).toBe(false);
		});
	});

	// ── Non-existent Resource Guards ──────────────────────────────

	describe("non-existent resource guards", () => {
		it("createReferral with bogus code id returns null", async () => {
			const result = await controller.createReferral({
				referralCodeId: "nonexistent-code",
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});
			expect(result).toBeNull();
		});

		it("completeReferral on missing id returns null", async () => {
			const result = await controller.completeReferral("no-such-id");
			expect(result).toBeNull();
		});

		it("revokeReferral on missing id returns null", async () => {
			const result = await controller.revokeReferral("no-such-id");
			expect(result).toBeNull();
		});

		it("markReferrerRewarded on missing id returns null", async () => {
			const result = await controller.markReferrerRewarded("no-such-id");
			expect(result).toBeNull();
		});

		it("markRefereeRewarded on missing id returns null", async () => {
			const result = await controller.markRefereeRewarded("no-such-id");
			expect(result).toBeNull();
		});
	});

	// ── Stats Isolation ───────────────────────────────────────────

	describe("stats isolation", () => {
		it("per-customer stats only reflect that customer", async () => {
			const codeA = await controller.createCode({
				customerId: "customer_a",
			});
			const codeB = await controller.createCode({
				customerId: "customer_b",
			});

			await controller.createReferral({
				referralCodeId: codeA.id,
				refereeCustomerId: "customer_x",
				refereeEmail: "x@example.com",
			});
			await controller.createReferral({
				referralCodeId: codeA.id,
				refereeCustomerId: "customer_y",
				refereeEmail: "y@example.com",
			});
			await controller.createReferral({
				referralCodeId: codeB.id,
				refereeCustomerId: "customer_z",
				refereeEmail: "z@example.com",
			});

			const statsA = await controller.getStatsForCustomer("customer_a");
			const statsB = await controller.getStatsForCustomer("customer_b");

			expect(statsA.totalReferrals).toBe(2);
			expect(statsB.totalReferrals).toBe(1);
		});

		it("global stats aggregate all referrals correctly", async () => {
			const code = await controller.createCode({
				customerId: "customer_a",
			});
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_b",
				refereeEmail: "b@example.com",
			});
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "customer_c",
				refereeEmail: "c@example.com",
			});
			await controller.completeReferral(ref?.id ?? "");

			const stats = await controller.getStats();
			expect(stats.totalReferrals).toBe(2);
			expect(stats.completedReferrals).toBe(1);
			expect(stats.pendingReferrals).toBe(1);
			expect(stats.conversionRate).toBe(0.5);
		});
	});

	// ── Reward Rule Isolation ─────────────────────────────────────

	describe("reward rule isolation", () => {
		it("deleted rule is no longer retrievable", async () => {
			const rule = await controller.createRewardRule({
				name: "Promo",
				referrerRewardType: "store_credit",
				referrerRewardValue: 10,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			await controller.deleteRewardRule(rule.id);

			const found = await controller.getRewardRule(rule.id);
			expect(found).toBeNull();
		});

		it("deactivated rule excluded from active listing", async () => {
			const rule = await controller.createRewardRule({
				name: "Seasonal",
				referrerRewardType: "percentage_discount",
				referrerRewardValue: 15,
				refereeRewardType: "percentage_discount",
				refereeRewardValue: 10,
			});
			await controller.updateRewardRule(rule.id, { active: false });

			const activeRules = await controller.listRewardRules({
				active: true,
			});
			expect(activeRules).toHaveLength(0);

			const inactiveRules = await controller.listRewardRules({
				active: false,
			});
			expect(inactiveRules).toHaveLength(1);
			expect(inactiveRules[0]?.id).toBe(rule.id);
		});

		it("deleting one rule does not affect another", async () => {
			const ruleA = await controller.createRewardRule({
				name: "Rule A",
				referrerRewardType: "store_credit",
				referrerRewardValue: 10,
				refereeRewardType: "store_credit",
				refereeRewardValue: 5,
			});
			const ruleB = await controller.createRewardRule({
				name: "Rule B",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 20,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 10,
			});
			await controller.deleteRewardRule(ruleA.id);

			const found = await controller.getRewardRule(ruleB.id);
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Rule B");
		});
	});
});
