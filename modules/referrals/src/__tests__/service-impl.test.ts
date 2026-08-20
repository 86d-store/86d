import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createReferralController } from "../service-impl";

function unwrap<T>(value: T | null | undefined): T {
	expect(value).not.toBeNull();
	return value as T;
}

describe("createReferralController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createReferralController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createReferralController(mockData);
	});

	// ── Codes ──────────────────────────────────────────────────────────

	describe("createCode", () => {
		it("creates a referral code for a customer", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			expect(code.id).toBeDefined();
			expect(code.customerId).toBe("cust-1");
			expect(code.code).toHaveLength(8);
			expect(code.active).toBe(true);
			expect(code.usageCount).toBe(0);
			expect(code.maxUses).toBe(0);
			expect(code.createdAt).toBeInstanceOf(Date);
		});

		it("creates with custom maxUses", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				maxUses: 10,
			});
			expect(code.maxUses).toBe(10);
		});

		it("creates with expiration date", async () => {
			const expires = new Date("2026-12-31");
			const code = await controller.createCode({
				customerId: "cust-1",
				expiresAt: expires,
			});
			expect(code.expiresAt).toEqual(expires);
		});

		it("generates unique codes", async () => {
			const a = await controller.createCode({ customerId: "cust-1" });
			const b = await controller.createCode({ customerId: "cust-2" });
			expect(a.code).not.toBe(b.code);
		});
	});

	describe("getCode", () => {
		it("returns code by id", async () => {
			const created = await controller.createCode({ customerId: "cust-1" });
			const found = await controller.getCode(created.id);
			expect(found?.code).toBe(created.code);
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getCode("missing");
			expect(found).toBeNull();
		});
	});

	describe("getCodeByCode", () => {
		it("returns code by code string", async () => {
			const created = await controller.createCode({ customerId: "cust-1" });
			const found = await controller.getCodeByCode(created.code);
			expect(found?.id).toBe(created.id);
		});

		it("returns null for non-existent code", async () => {
			const found = await controller.getCodeByCode("NONEXIST");
			expect(found).toBeNull();
		});
	});

	describe("getCodeForCustomer", () => {
		it("returns code for customer", async () => {
			await controller.createCode({ customerId: "cust-1" });
			const found = await controller.getCodeForCustomer("cust-1");
			expect(found?.customerId).toBe("cust-1");
		});

		it("returns null when customer has no code", async () => {
			const found = await controller.getCodeForCustomer("cust-99");
			expect(found).toBeNull();
		});
	});

	describe("listCodes", () => {
		it("lists all codes", async () => {
			await controller.createCode({ customerId: "cust-1" });
			await controller.createCode({ customerId: "cust-2" });
			const all = await controller.listCodes();
			expect(all).toHaveLength(2);
		});

		it("filters by active status", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.createCode({ customerId: "cust-2" });
			await controller.deactivateCode(code.id);

			const active = await controller.listCodes({ active: true });
			expect(active).toHaveLength(1);

			const inactive = await controller.listCodes({ active: false });
			expect(inactive).toHaveLength(1);
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createCode({ customerId: `cust-${i}` });
			}
			const page = await controller.listCodes({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	describe("deactivateCode", () => {
		it("deactivates a code", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const deactivated = await controller.deactivateCode(code.id);
			expect(deactivated?.active).toBe(false);
		});

		it("returns null for non-existent code", async () => {
			const result = await controller.deactivateCode("missing");
			expect(result).toBeNull();
		});
	});

	// ── Referrals ──────────────────────────────────────────────────────

	describe("createReferral", () => {
		it("creates a referral from a valid code", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const referral = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "referee@test.com",
			});
			expect(referral).not.toBeNull();
			expect(referral?.referrerCustomerId).toBe("cust-1");
			expect(referral?.refereeCustomerId).toBe("cust-2");
			expect(referral?.status).toBe("pending");
			expect(referral?.referrerRewarded).toBe(false);
			expect(referral?.refereeRewarded).toBe(false);
		});

		it("increments usage count on the code", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const updated = await controller.getCode(code.id);
			expect(updated?.usageCount).toBe(1);
		});

		it("returns null for non-existent code", async () => {
			const result = await controller.createReferral({
				referralCodeId: "missing",
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			expect(result).toBeNull();
		});

		it("prevents self-referral", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const result = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-1",
				refereeEmail: "self@test.com",
			});
			expect(result).toBeNull();
		});

		it("prevents usage of inactive code", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.deactivateCode(code.id);
			const result = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			expect(result).toBeNull();
		});

		it("prevents usage beyond maxUses", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				maxUses: 1,
			});
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const result = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-3",
				refereeEmail: "b@test.com",
			});
			expect(result).toBeNull();
		});

		it("prevents usage of expired code", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				expiresAt: new Date("2020-01-01"),
			});
			const result = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			expect(result).toBeNull();
		});
	});

	describe("getReferral", () => {
		it("returns referral by id", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const created = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const found = await controller.getReferral(unwrap(created).id);
			expect(found?.refereeEmail).toBe("a@test.com");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getReferral("missing");
			expect(found).toBeNull();
		});
	});

	describe("listReferrals", () => {
		it("lists all referrals", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-3",
				refereeEmail: "b@test.com",
			});
			const all = await controller.listReferrals();
			expect(all).toHaveLength(2);
		});

		it("filters by referrer", async () => {
			const code1 = await controller.createCode({ customerId: "cust-1" });
			const code2 = await controller.createCode({ customerId: "cust-10" });
			await controller.createReferral({
				referralCodeId: code1.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			await controller.createReferral({
				referralCodeId: code2.id,
				refereeCustomerId: "cust-3",
				refereeEmail: "b@test.com",
			});
			const filtered = await controller.listReferrals({
				referrerCustomerId: "cust-1",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].referrerCustomerId).toBe("cust-1");
		});

		it("filters by status", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-3",
				refereeEmail: "b@test.com",
			});
			await controller.completeReferral(unwrap(ref).id);

			const pending = await controller.listReferrals({ status: "pending" });
			expect(pending).toHaveLength(1);

			const completed = await controller.listReferrals({
				status: "completed",
			});
			expect(completed).toHaveLength(1);
		});
	});

	describe("completeReferral", () => {
		it("completes a pending referral", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const completed = await controller.completeReferral(unwrap(ref).id);
			expect(completed?.status).toBe("completed");
			expect(completed?.completedAt).toBeInstanceOf(Date);
		});

		it("returns null for non-pending referral", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			await controller.completeReferral(unwrap(ref).id);
			const again = await controller.completeReferral(unwrap(ref).id);
			expect(again).toBeNull();
		});

		it("returns null for non-existent referral", async () => {
			const result = await controller.completeReferral("missing");
			expect(result).toBeNull();
		});
	});

	describe("revokeReferral", () => {
		it("revokes a pending referral", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const revoked = await controller.revokeReferral(unwrap(ref).id);
			expect(revoked?.status).toBe("revoked");
		});

		it("cannot revoke a completed referral", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			await controller.completeReferral(unwrap(ref).id);
			const result = await controller.revokeReferral(unwrap(ref).id);
			expect(result).toBeNull();
		});
	});

	describe("markReferrerRewarded", () => {
		it("marks referrer as rewarded", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const result = await controller.markReferrerRewarded(unwrap(ref).id);
			expect(result?.referrerRewarded).toBe(true);
		});

		it("returns null for non-existent referral", async () => {
			const result = await controller.markReferrerRewarded("missing");
			expect(result).toBeNull();
		});
	});

	describe("markRefereeRewarded", () => {
		it("marks referee as rewarded", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const result = await controller.markRefereeRewarded(unwrap(ref).id);
			expect(result?.refereeRewarded).toBe(true);
		});
	});

	// ── Reward Rules ───────────────────────────────────────────────────

	describe("createRewardRule", () => {
		it("creates a reward rule", async () => {
			const rule = await controller.createRewardRule({
				name: "Welcome Bonus",
				referrerRewardType: "percentage_discount",
				referrerRewardValue: 10,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			expect(rule.id).toBeDefined();
			expect(rule.name).toBe("Welcome Bonus");
			expect(rule.referrerRewardType).toBe("percentage_discount");
			expect(rule.referrerRewardValue).toBe(10);
			expect(rule.refereeRewardType).toBe("fixed_discount");
			expect(rule.refereeRewardValue).toBe(5);
			expect(rule.minOrderAmount).toBe(0);
			expect(rule.active).toBe(true);
		});

		it("creates with minOrderAmount", async () => {
			const rule = await controller.createRewardRule({
				name: "Premium",
				referrerRewardType: "store_credit",
				referrerRewardValue: 20,
				refereeRewardType: "store_credit",
				refereeRewardValue: 10,
				minOrderAmount: 50,
			});
			expect(rule.minOrderAmount).toBe(50);
		});
	});

	describe("getRewardRule", () => {
		it("returns rule by id", async () => {
			const created = await controller.createRewardRule({
				name: "Test",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			const found = await controller.getRewardRule(created.id);
			expect(found?.name).toBe("Test");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getRewardRule("missing");
			expect(found).toBeNull();
		});
	});

	describe("listRewardRules", () => {
		it("lists all rules", async () => {
			await controller.createRewardRule({
				name: "A",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			await controller.createRewardRule({
				name: "B",
				referrerRewardType: "store_credit",
				referrerRewardValue: 10,
				refereeRewardType: "store_credit",
				refereeRewardValue: 10,
			});
			const all = await controller.listRewardRules();
			expect(all).toHaveLength(2);
		});

		it("filters by active status", async () => {
			const rule = await controller.createRewardRule({
				name: "A",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			await controller.updateRewardRule(rule.id, { active: false });

			const active = await controller.listRewardRules({ active: true });
			expect(active).toHaveLength(0);

			const inactive = await controller.listRewardRules({ active: false });
			expect(inactive).toHaveLength(1);
		});
	});

	describe("updateRewardRule", () => {
		it("updates rule fields", async () => {
			const rule = await controller.createRewardRule({
				name: "Original",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			const updated = await controller.updateRewardRule(rule.id, {
				name: "Updated",
				referrerRewardValue: 15,
			});
			expect(updated?.name).toBe("Updated");
			expect(updated?.referrerRewardValue).toBe(15);
			expect(updated?.refereeRewardValue).toBe(5);
		});

		it("returns null for non-existent rule", async () => {
			const result = await controller.updateRewardRule("missing", {
				name: "Nope",
			});
			expect(result).toBeNull();
		});

		it("toggles active status", async () => {
			const rule = await controller.createRewardRule({
				name: "Test",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			const disabled = await controller.updateRewardRule(rule.id, {
				active: false,
			});
			expect(disabled?.active).toBe(false);
		});
	});

	describe("deleteRewardRule", () => {
		it("deletes an existing rule", async () => {
			const rule = await controller.createRewardRule({
				name: "Delete me",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			const result = await controller.deleteRewardRule(rule.id);
			expect(result).toBe(true);
			const found = await controller.getRewardRule(rule.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent rule", async () => {
			const result = await controller.deleteRewardRule("missing");
			expect(result).toBe(false);
		});
	});

	// ── Stats ──────────────────────────────────────────────────────────

	describe("getStats", () => {
		it("returns zeroes when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalCodes).toBe(0);
			expect(stats.totalReferrals).toBe(0);
			expect(stats.completedReferrals).toBe(0);
			expect(stats.pendingReferrals).toBe(0);
			expect(stats.conversionRate).toBe(0);
		});

		it("counts codes and referrals", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.createCode({ customerId: "cust-10" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-3",
				refereeEmail: "b@test.com",
			});
			await controller.completeReferral(unwrap(ref).id);

			const stats = await controller.getStats();
			expect(stats.totalCodes).toBe(2);
			expect(stats.totalReferrals).toBe(2);
			expect(stats.completedReferrals).toBe(1);
			expect(stats.pendingReferrals).toBe(1);
			expect(stats.conversionRate).toBe(0.5);
		});
	});

	describe("getStatsForCustomer", () => {
		it("returns stats for a customer with referrals", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-3",
				refereeEmail: "b@test.com",
			});
			await controller.completeReferral(unwrap(ref).id);

			const stats = await controller.getStatsForCustomer("cust-1");
			expect(stats.code?.code).toBe(code.code);
			expect(stats.totalReferrals).toBe(2);
			expect(stats.completedReferrals).toBe(1);
			expect(stats.pendingReferrals).toBe(1);
		});

		it("returns null code for customer without one", async () => {
			const stats = await controller.getStatsForCustomer("cust-99");
			expect(stats.code).toBeNull();
			expect(stats.totalReferrals).toBe(0);
		});
	});

	// ── Full lifecycle ─────────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("code → referral → complete → reward", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "friend@test.com",
			});
			expect(ref?.status).toBe("pending");

			const completed = await controller.completeReferral(unwrap(ref).id);
			expect(completed?.status).toBe("completed");
			expect(completed?.completedAt).toBeInstanceOf(Date);

			await controller.markReferrerRewarded(unwrap(ref).id);
			await controller.markRefereeRewarded(unwrap(ref).id);

			const final = await controller.getReferral(unwrap(ref).id);
			expect(final?.referrerRewarded).toBe(true);
			expect(final?.refereeRewarded).toBe(true);
		});

		it("code → referral → revoke prevents completion", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			await controller.revokeReferral(unwrap(ref).id);
			const result = await controller.completeReferral(unwrap(ref).id);
			expect(result).toBeNull();
		});

		it("multiple referrals for one referrer", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			for (let i = 2; i <= 6; i++) {
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: `cust-${i}`,
					refereeEmail: `user${i}@test.com`,
				});
			}
			const updatedCode = await controller.getCode(code.id);
			expect(updatedCode?.usageCount).toBe(5);

			const stats = await controller.getStatsForCustomer("cust-1");
			expect(stats.totalReferrals).toBe(5);
		});

		it("reward rule CRUD lifecycle", async () => {
			const rule = await controller.createRewardRule({
				name: "Launch Promo",
				referrerRewardType: "percentage_discount",
				referrerRewardValue: 15,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 10,
				minOrderAmount: 25,
			});

			const updated = await controller.updateRewardRule(rule.id, {
				referrerRewardValue: 20,
			});
			expect(updated?.referrerRewardValue).toBe(20);

			const disabled = await controller.updateRewardRule(rule.id, {
				active: false,
			});
			expect(disabled?.active).toBe(false);

			const deleted = await controller.deleteRewardRule(rule.id);
			expect(deleted).toBe(true);

			const gone = await controller.getRewardRule(rule.id);
			expect(gone).toBeNull();
		});
	});
});
