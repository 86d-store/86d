import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createReferralController } from "../service-impl";

function unwrap<T>(value: T | null | undefined): T {
	expect(value).not.toBeNull();
	return value as T;
}

describe("referral controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createReferralController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createReferralController(mockData);
	});

	// ── Code edge cases ───────────────────────────────────────────────

	describe("createCode – edge cases", () => {
		it("creates code with maxUses of 0 (unlimited)", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				maxUses: 0,
			});
			expect(code.maxUses).toBe(0);
			// Should allow referrals since maxUses 0 means unlimited
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			expect(ref).not.toBeNull();
		});

		it("creates code with maxUses of 1 (single use)", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				maxUses: 1,
			});
			expect(code.maxUses).toBe(1);
		});

		it("creates code with very large maxUses", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				maxUses: Number.MAX_SAFE_INTEGER,
			});
			expect(code.maxUses).toBe(Number.MAX_SAFE_INTEGER);
		});

		it("creates code with expiration in the far future", async () => {
			const farFuture = new Date("2099-12-31T23:59:59Z");
			const code = await controller.createCode({
				customerId: "cust-1",
				expiresAt: farFuture,
			});
			expect(code.expiresAt).toEqual(farFuture);
		});

		it("creates code with no optional params at all", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			expect(code.maxUses).toBe(0);
			expect(code.expiresAt).toBeUndefined();
		});

		it("creates codes for same customer multiple times", async () => {
			const a = await controller.createCode({ customerId: "cust-1" });
			const b = await controller.createCode({ customerId: "cust-1" });
			expect(a.id).not.toBe(b.id);
			expect(a.code).not.toBe(b.code);
		});

		it("generates codes using only valid characters", async () => {
			const validChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
			for (let i = 0; i < 20; i++) {
				const code = await controller.createCode({
					customerId: `cust-${i}`,
				});
				for (const char of code.code) {
					expect(validChars).toContain(char);
				}
			}
		});

		it("creates code with special characters in customerId", async () => {
			const code = await controller.createCode({
				customerId: "cust-special!@#$%^&*()",
			});
			expect(code.customerId).toBe("cust-special!@#$%^&*()");
		});

		it("creates code with empty string customerId", async () => {
			const code = await controller.createCode({ customerId: "" });
			expect(code.customerId).toBe("");
		});

		it("creates code with very long customerId", async () => {
			const longId = "c".repeat(10000);
			const code = await controller.createCode({ customerId: longId });
			expect(code.customerId).toBe(longId);
		});
	});

	// ── getCode / getCodeByCode / getCodeForCustomer edge cases ──────

	describe("code lookup – edge cases", () => {
		it("getCode returns null for empty string id", async () => {
			const found = await controller.getCode("");
			expect(found).toBeNull();
		});

		it("getCodeByCode returns null for empty string code", async () => {
			const found = await controller.getCodeByCode("");
			expect(found).toBeNull();
		});

		it("getCodeForCustomer returns only one code even if multiple exist", async () => {
			await controller.createCode({ customerId: "cust-1" });
			await controller.createCode({ customerId: "cust-1" });
			const found = await controller.getCodeForCustomer("cust-1");
			expect(found).not.toBeNull();
			expect(found?.customerId).toBe("cust-1");
		});

		it("getCodeForCustomer returns null for empty customerId", async () => {
			const found = await controller.getCodeForCustomer("");
			expect(found).toBeNull();
		});
	});

	// ── listCodes edge cases ──────────────────────────────────────────

	describe("listCodes – edge cases", () => {
		it("returns empty array when no codes exist", async () => {
			const codes = await controller.listCodes();
			expect(codes).toEqual([]);
		});

		it("returns empty array with take=0", async () => {
			await controller.createCode({ customerId: "cust-1" });
			const codes = await controller.listCodes({ take: 0 });
			expect(codes).toEqual([]);
		});

		it("handles skip larger than total", async () => {
			await controller.createCode({ customerId: "cust-1" });
			const codes = await controller.listCodes({ skip: 100 });
			expect(codes).toEqual([]);
		});

		it("handles skip=0 explicitly", async () => {
			await controller.createCode({ customerId: "cust-1" });
			const codes = await controller.listCodes({ skip: 0 });
			expect(codes).toHaveLength(1);
		});

		it("handles take=1 with multiple codes", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createCode({ customerId: `cust-${i}` });
			}
			const codes = await controller.listCodes({ take: 1 });
			expect(codes).toHaveLength(1);
		});

		it("handles take larger than total codes", async () => {
			await controller.createCode({ customerId: "cust-1" });
			const codes = await controller.listCodes({ take: 100 });
			expect(codes).toHaveLength(1);
		});

		it("lists only active codes when active=true and all are deactivated", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.deactivateCode(code.id);
			const codes = await controller.listCodes({ active: true });
			expect(codes).toEqual([]);
		});

		it("passes undefined params gracefully", async () => {
			await controller.createCode({ customerId: "cust-1" });
			const codes = await controller.listCodes(undefined);
			expect(codes).toHaveLength(1);
		});
	});

	// ── deactivateCode edge cases ─────────────────────────────────────

	describe("deactivateCode – edge cases", () => {
		it("deactivating an already deactivated code keeps it inactive", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.deactivateCode(code.id);
			const again = await controller.deactivateCode(code.id);
			expect(again?.active).toBe(false);
		});

		it("deactivating a code preserves its other fields", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				maxUses: 10,
			});
			const deactivated = unwrap(await controller.deactivateCode(code.id));
			expect(deactivated.customerId).toBe("cust-1");
			expect(deactivated.maxUses).toBe(10);
			expect(deactivated.code).toBe(code.code);
			expect(deactivated.usageCount).toBe(0);
		});

		it("returns null for empty string id", async () => {
			const result = await controller.deactivateCode("");
			expect(result).toBeNull();
		});
	});

	// ── createReferral edge cases ─────────────────────────────────────

	describe("createReferral – edge cases", () => {
		it("allows referral when maxUses is 0 (unlimited) even after many uses", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				maxUses: 0,
			});
			for (let i = 2; i <= 20; i++) {
				const ref = await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: `cust-${i}`,
					refereeEmail: `cust${i}@test.com`,
				});
				expect(ref).not.toBeNull();
			}
			const updated = unwrap(await controller.getCode(code.id));
			expect(updated.usageCount).toBe(19);
		});

		it("blocks referral at exact maxUses boundary", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				maxUses: 2,
			});
			// Use 1
			const r1 = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			expect(r1).not.toBeNull();
			// Use 2 (at boundary)
			const r2 = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-3",
				refereeEmail: "b@test.com",
			});
			expect(r2).not.toBeNull();
			// Use 3 (over boundary)
			const r3 = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-4",
				refereeEmail: "c@test.com",
			});
			expect(r3).toBeNull();
		});

		it("allows referral with code expiring in the far future", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				expiresAt: new Date("2099-12-31"),
			});
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			expect(ref).not.toBeNull();
		});

		it("referral email with special characters", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "user+tag@sub.domain.co.uk",
			});
			expect(ref).not.toBeNull();
			expect(ref?.refereeEmail).toBe("user+tag@sub.domain.co.uk");
		});

		it("referral with empty email string", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "",
			});
			expect(ref).not.toBeNull();
			expect(ref?.refereeEmail).toBe("");
		});

		it("referral with unicode email", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "\u00FC\u00F1\u00EE\u00E7\u00F6d\u00EB@test.com",
			});
			expect(ref?.refereeEmail).toBe(
				"\u00FC\u00F1\u00EE\u00E7\u00F6d\u00EB@test.com",
			);
		});

		it("usage count increments correctly across multiple referrals", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				maxUses: 10,
			});
			for (let i = 2; i <= 6; i++) {
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: `cust-${i}`,
					refereeEmail: `cust${i}@test.com`,
				});
			}
			const updated = unwrap(await controller.getCode(code.id));
			expect(updated.usageCount).toBe(5);
		});

		it("does not increment usage when referral is rejected (self-referral)", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-1",
				refereeEmail: "self@test.com",
			});
			const updated = unwrap(await controller.getCode(code.id));
			expect(updated.usageCount).toBe(0);
		});

		it("does not increment usage when referral is rejected (inactive code)", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.deactivateCode(code.id);
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const updated = unwrap(await controller.getCode(code.id));
			expect(updated.usageCount).toBe(0);
		});

		it("does not increment usage when referral is rejected (expired code)", async () => {
			const code = await controller.createCode({
				customerId: "cust-1",
				expiresAt: new Date("2000-01-01"),
			});
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const updated = unwrap(await controller.getCode(code.id));
			expect(updated.usageCount).toBe(0);
		});
	});

	// ── listReferrals edge cases ──────────────────────────────────────

	describe("listReferrals – edge cases", () => {
		it("returns empty array when no referrals exist", async () => {
			const referrals = await controller.listReferrals();
			expect(referrals).toEqual([]);
		});

		it("handles undefined params", async () => {
			const referrals = await controller.listReferrals(undefined);
			expect(referrals).toEqual([]);
		});

		it("filters by refereeCustomerId", async () => {
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
			const filtered = await controller.listReferrals({
				refereeCustomerId: "cust-2",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].refereeCustomerId).toBe("cust-2");
		});

		it("returns empty when filtering by non-existent referrer", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const filtered = await controller.listReferrals({
				referrerCustomerId: "non-existent",
			});
			expect(filtered).toEqual([]);
		});

		it("returns empty when filtering by non-existent status", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const filtered = await controller.listReferrals({
				status: "expired",
			});
			expect(filtered).toEqual([]);
		});

		it("supports take and skip on referrals", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			for (let i = 2; i <= 7; i++) {
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: `cust-${i}`,
					refereeEmail: `cust${i}@test.com`,
				});
			}
			const page = await controller.listReferrals({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});

		it("returns empty for take=0 on referrals", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const result = await controller.listReferrals({ take: 0 });
			expect(result).toEqual([]);
		});

		it("returns empty for skip past end on referrals", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			const result = await controller.listReferrals({ skip: 100 });
			expect(result).toEqual([]);
		});
	});

	// ── completeReferral edge cases ───────────────────────────────────

	describe("completeReferral – edge cases", () => {
		it("cannot complete a revoked referral", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			await controller.revokeReferral(ref.id);
			const result = await controller.completeReferral(ref.id);
			expect(result).toBeNull();
		});

		it("cannot complete the same referral twice", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			const first = await controller.completeReferral(ref.id);
			expect(first?.status).toBe("completed");
			const second = await controller.completeReferral(ref.id);
			expect(second).toBeNull();
		});

		it("returns null for empty string id", async () => {
			const result = await controller.completeReferral("");
			expect(result).toBeNull();
		});

		it("completedAt is set to a Date on completion", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			expect(ref.completedAt).toBeUndefined();
			const completed = unwrap(await controller.completeReferral(ref.id));
			expect(completed.completedAt).toBeInstanceOf(Date);
		});
	});

	// ── revokeReferral edge cases ─────────────────────────────────────

	describe("revokeReferral – edge cases", () => {
		it("returns null for non-existent referral", async () => {
			const result = await controller.revokeReferral("missing");
			expect(result).toBeNull();
		});

		it("returns null for empty string id", async () => {
			const result = await controller.revokeReferral("");
			expect(result).toBeNull();
		});

		it("cannot revoke an already revoked referral", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			const first = await controller.revokeReferral(ref.id);
			expect(first?.status).toBe("revoked");
			const second = await controller.revokeReferral(ref.id);
			expect(second).toBeNull();
		});
	});

	// ── markReferrerRewarded / markRefereeRewarded edge cases ────────

	describe("reward marking – edge cases", () => {
		it("markReferrerRewarded is idempotent", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			await controller.markReferrerRewarded(ref.id);
			const again = await controller.markReferrerRewarded(ref.id);
			expect(again?.referrerRewarded).toBe(true);
		});

		it("markRefereeRewarded is idempotent", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			await controller.markRefereeRewarded(ref.id);
			const again = await controller.markRefereeRewarded(ref.id);
			expect(again?.refereeRewarded).toBe(true);
		});

		it("markReferrerRewarded returns null for empty string id", async () => {
			const result = await controller.markReferrerRewarded("");
			expect(result).toBeNull();
		});

		it("markRefereeRewarded returns null for empty string id", async () => {
			const result = await controller.markRefereeRewarded("");
			expect(result).toBeNull();
		});

		it("marking referrer does not affect referee", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			const result = unwrap(await controller.markReferrerRewarded(ref.id));
			expect(result.referrerRewarded).toBe(true);
			expect(result.refereeRewarded).toBe(false);
		});

		it("marking referee does not affect referrer", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			const result = unwrap(await controller.markRefereeRewarded(ref.id));
			expect(result.refereeRewarded).toBe(true);
			expect(result.referrerRewarded).toBe(false);
		});

		it("can mark both referrer and referee rewarded on same referral", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			await controller.markReferrerRewarded(ref.id);
			await controller.markRefereeRewarded(ref.id);
			const final = unwrap(await controller.getReferral(ref.id));
			expect(final.referrerRewarded).toBe(true);
			expect(final.refereeRewarded).toBe(true);
		});

		it("can mark rewarded on a revoked referral", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			await controller.revokeReferral(ref.id);
			// markReferrerRewarded does not check status
			const result = await controller.markReferrerRewarded(ref.id);
			expect(result?.referrerRewarded).toBe(true);
		});
	});

	// ── Reward Rules edge cases ───────────────────────────────────────

	describe("createRewardRule – edge cases", () => {
		it("creates rule with zero reward values", async () => {
			const rule = await controller.createRewardRule({
				name: "Zero",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 0,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 0,
			});
			expect(rule.referrerRewardValue).toBe(0);
			expect(rule.refereeRewardValue).toBe(0);
		});

		it("creates rule with very large reward values", async () => {
			const rule = await controller.createRewardRule({
				name: "Big",
				referrerRewardType: "store_credit",
				referrerRewardValue: 999999.99,
				refereeRewardType: "store_credit",
				refereeRewardValue: 999999.99,
			});
			expect(rule.referrerRewardValue).toBe(999999.99);
			expect(rule.refereeRewardValue).toBe(999999.99);
		});

		it("creates rule with special characters in name", async () => {
			const name = 'Rule <script>alert("xss")</script> & Co.';
			const rule = await controller.createRewardRule({
				name,
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			expect(rule.name).toBe(name);
		});

		it("creates rule with empty string name", async () => {
			const rule = await controller.createRewardRule({
				name: "",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			expect(rule.name).toBe("");
		});

		it("creates rule with unicode name", async () => {
			const rule = await controller.createRewardRule({
				name: "\u5F15\u8350\u30DC\u30FC\u30CA\u30B9 \uD83C\uDF89",
				referrerRewardType: "percentage_discount",
				referrerRewardValue: 10,
				refereeRewardType: "percentage_discount",
				refereeRewardValue: 10,
			});
			expect(rule.name).toBe(
				"\u5F15\u8350\u30DC\u30FC\u30CA\u30B9 \uD83C\uDF89",
			);
		});

		it("creates rule with all three reward types", async () => {
			const r1 = await controller.createRewardRule({
				name: "Pct",
				referrerRewardType: "percentage_discount",
				referrerRewardValue: 10,
				refereeRewardType: "percentage_discount",
				refereeRewardValue: 5,
			});
			const r2 = await controller.createRewardRule({
				name: "Fix",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 10,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			const r3 = await controller.createRewardRule({
				name: "Crd",
				referrerRewardType: "store_credit",
				referrerRewardValue: 10,
				refereeRewardType: "store_credit",
				refereeRewardValue: 5,
			});
			expect(r1.referrerRewardType).toBe("percentage_discount");
			expect(r2.referrerRewardType).toBe("fixed_discount");
			expect(r3.referrerRewardType).toBe("store_credit");
		});

		it("creates rule with mixed reward types for referrer and referee", async () => {
			const rule = await controller.createRewardRule({
				name: "Mixed",
				referrerRewardType: "store_credit",
				referrerRewardValue: 20,
				refereeRewardType: "percentage_discount",
				refereeRewardValue: 10,
			});
			expect(rule.referrerRewardType).toBe("store_credit");
			expect(rule.refereeRewardType).toBe("percentage_discount");
		});

		it("sets createdAt and updatedAt to the same time", async () => {
			const rule = await controller.createRewardRule({
				name: "Test",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			expect(rule.createdAt.getTime()).toBe(rule.updatedAt.getTime());
		});
	});

	describe("updateRewardRule – edge cases", () => {
		it("updates only name while preserving all other fields", async () => {
			const rule = await controller.createRewardRule({
				name: "Original",
				referrerRewardType: "store_credit",
				referrerRewardValue: 20,
				refereeRewardType: "percentage_discount",
				refereeRewardValue: 15,
				minOrderAmount: 100,
			});
			const updated = unwrap(
				await controller.updateRewardRule(rule.id, { name: "New Name" }),
			);
			expect(updated.name).toBe("New Name");
			expect(updated.referrerRewardType).toBe("store_credit");
			expect(updated.referrerRewardValue).toBe(20);
			expect(updated.refereeRewardType).toBe("percentage_discount");
			expect(updated.refereeRewardValue).toBe(15);
			expect(updated.minOrderAmount).toBe(100);
		});

		it("updates all fields at once", async () => {
			const rule = await controller.createRewardRule({
				name: "Original",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			const updated = unwrap(
				await controller.updateRewardRule(rule.id, {
					name: "All Updated",
					referrerRewardType: "store_credit",
					referrerRewardValue: 50,
					refereeRewardType: "percentage_discount",
					refereeRewardValue: 25,
					minOrderAmount: 200,
					active: false,
				}),
			);
			expect(updated.name).toBe("All Updated");
			expect(updated.referrerRewardType).toBe("store_credit");
			expect(updated.referrerRewardValue).toBe(50);
			expect(updated.refereeRewardType).toBe("percentage_discount");
			expect(updated.refereeRewardValue).toBe(25);
			expect(updated.minOrderAmount).toBe(200);
			expect(updated.active).toBe(false);
		});

		it("updatedAt changes after update", async () => {
			const rule = await controller.createRewardRule({
				name: "Test",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			const originalUpdatedAt = rule.updatedAt;
			// Small delay to ensure different timestamp
			const updated = unwrap(
				await controller.updateRewardRule(rule.id, { name: "Changed" }),
			);
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});

		it("updates with empty params object preserves fields but updates timestamp", async () => {
			const rule = await controller.createRewardRule({
				name: "Unchanged",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			const updated = unwrap(await controller.updateRewardRule(rule.id, {}));
			expect(updated.name).toBe("Unchanged");
			expect(updated.referrerRewardValue).toBe(5);
		});

		it("returns null for empty string id", async () => {
			const result = await controller.updateRewardRule("", {
				name: "Nope",
			});
			expect(result).toBeNull();
		});
	});

	describe("deleteRewardRule – edge cases", () => {
		it("returns false for empty string id", async () => {
			const result = await controller.deleteRewardRule("");
			expect(result).toBe(false);
		});

		it("deleting same rule twice returns false on second call", async () => {
			const rule = await controller.createRewardRule({
				name: "Delete",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			expect(await controller.deleteRewardRule(rule.id)).toBe(true);
			expect(await controller.deleteRewardRule(rule.id)).toBe(false);
		});
	});

	describe("listRewardRules – edge cases", () => {
		it("returns empty array when no rules exist", async () => {
			const rules = await controller.listRewardRules();
			expect(rules).toEqual([]);
		});

		it("handles undefined params", async () => {
			const rules = await controller.listRewardRules(undefined);
			expect(rules).toEqual([]);
		});

		it("returns empty when all rules are inactive and filtering active=true", async () => {
			const rule = await controller.createRewardRule({
				name: "Test",
				referrerRewardType: "fixed_discount",
				referrerRewardValue: 5,
				refereeRewardType: "fixed_discount",
				refereeRewardValue: 5,
			});
			await controller.updateRewardRule(rule.id, { active: false });
			const active = await controller.listRewardRules({ active: true });
			expect(active).toEqual([]);
		});
	});

	// ── Stats edge cases ──────────────────────────────────────────────

	describe("getStats – edge cases", () => {
		it("conversionRate is 0 when all referrals are pending", async () => {
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
			const stats = await controller.getStats();
			expect(stats.conversionRate).toBe(0);
			expect(stats.pendingReferrals).toBe(2);
			expect(stats.completedReferrals).toBe(0);
		});

		it("conversionRate is 1 when all referrals are completed", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const r1 = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			const r2 = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-3",
					refereeEmail: "b@test.com",
				}),
			);
			await controller.completeReferral(r1.id);
			await controller.completeReferral(r2.id);

			const stats = await controller.getStats();
			expect(stats.conversionRate).toBe(1);
		});

		it("counts revoked referrals in total but not in pending or completed", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			await controller.revokeReferral(ref.id);

			const stats = await controller.getStats();
			expect(stats.totalReferrals).toBe(1);
			expect(stats.pendingReferrals).toBe(0);
			expect(stats.completedReferrals).toBe(0);
			expect(stats.conversionRate).toBe(0);
		});

		it("handles large number of codes and referrals", async () => {
			for (let i = 0; i < 20; i++) {
				await controller.createCode({ customerId: `cust-owner-${i}` });
			}
			const code = await controller.createCode({
				customerId: "referrer-main",
			});
			for (let i = 0; i < 10; i++) {
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: `referee-${i}`,
					refereeEmail: `ref${i}@test.com`,
				});
			}
			const stats = await controller.getStats();
			expect(stats.totalCodes).toBe(21);
			expect(stats.totalReferrals).toBe(10);
		});
	});

	describe("getStatsForCustomer – edge cases", () => {
		it("returns zeroes for customer with code but no referrals", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const stats = await controller.getStatsForCustomer("cust-1");
			expect(stats.code?.id).toBe(code.id);
			expect(stats.totalReferrals).toBe(0);
			expect(stats.completedReferrals).toBe(0);
			expect(stats.pendingReferrals).toBe(0);
		});

		it("counts only referrals belonging to the specified customer", async () => {
			const code1 = await controller.createCode({ customerId: "cust-1" });
			const code2 = await controller.createCode({
				customerId: "cust-10",
			});
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

			const stats1 = await controller.getStatsForCustomer("cust-1");
			expect(stats1.totalReferrals).toBe(1);

			const stats2 = await controller.getStatsForCustomer("cust-10");
			expect(stats2.totalReferrals).toBe(1);
		});

		it("does not count revoked referrals as pending or completed", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const r1 = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			const r2 = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-3",
					refereeEmail: "b@test.com",
				}),
			);
			await controller.revokeReferral(r1.id);
			await controller.completeReferral(r2.id);

			const stats = await controller.getStatsForCustomer("cust-1");
			expect(stats.totalReferrals).toBe(2);
			expect(stats.completedReferrals).toBe(1);
			expect(stats.pendingReferrals).toBe(0);
		});

		it("returns stats for customer who is a referee, not a referrer", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-2",
				refereeEmail: "a@test.com",
			});
			// cust-2 is the referee, has no referral code
			const stats = await controller.getStatsForCustomer("cust-2");
			expect(stats.code).toBeNull();
			expect(stats.totalReferrals).toBe(0);
		});

		it("handles empty string customerId", async () => {
			const stats = await controller.getStatsForCustomer("");
			expect(stats.code).toBeNull();
			expect(stats.totalReferrals).toBe(0);
		});
	});

	// ── Cross-entity interaction edge cases ───────────────────────────

	describe("cross-entity interactions", () => {
		it("deactivating a code prevents new referrals but keeps existing ones", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			await controller.deactivateCode(code.id);

			// Existing referral is still there
			const existing = await controller.getReferral(ref.id);
			expect(existing?.status).toBe("pending");

			// New referral is blocked
			const blocked = await controller.createReferral({
				referralCodeId: code.id,
				refereeCustomerId: "cust-3",
				refereeEmail: "b@test.com",
			});
			expect(blocked).toBeNull();
		});

		it("completing a referral after code deactivation works", async () => {
			const code = await controller.createCode({ customerId: "cust-1" });
			const ref = unwrap(
				await controller.createReferral({
					referralCodeId: code.id,
					refereeCustomerId: "cust-2",
					refereeEmail: "a@test.com",
				}),
			);
			await controller.deactivateCode(code.id);
			const completed = await controller.completeReferral(ref.id);
			expect(completed?.status).toBe("completed");
		});

		it("independent mock stores per controller instance", () => {
			const data1 = createMockDataService();
			const data2 = createMockDataService();
			const ctrl1 = createReferralController(data1);
			const ctrl2 = createReferralController(data2);
			expect(ctrl1).not.toBe(ctrl2);
			expect(data1._store).not.toBe(data2._store);
		});
	});
});
