import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Referral,
	ReferralCode,
	ReferralController,
	ReferralRewardRule,
	ReferralStats,
} from "./service";

function generateCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let code = "";
	for (let i = 0; i < 8; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

export function createReferralController(
	data: ModuleDataService,
): ReferralController {
	return {
		// ── Codes ──────────────────────────────────────────────

		async createCode(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const code: ReferralCode = {
				id,
				customerId: params.customerId,
				customerEmail: params.customerEmail,
				code: generateCode(),
				active: true,
				usageCount: 0,
				maxUses: params.maxUses ?? 0,
				expiresAt: params.expiresAt,
				createdAt: now,
			};
			await data.upsert("referralCode", id, code as Record<string, unknown>);
			return code;
		},

		async getCode(id) {
			const raw = await data.get("referralCode", id);
			if (!raw) return null;
			return raw as unknown as ReferralCode;
		},

		async getCodeByCode(code) {
			const matches = await data.findMany("referralCode", {
				where: { code },
				take: 1,
			});
			if (matches.length === 0) return null;
			return matches[0] as unknown as ReferralCode;
		},

		async getCodeForCustomer(customerId) {
			const matches = await data.findMany("referralCode", {
				where: { customerId },
				take: 1,
			});
			if (matches.length === 0) return null;
			return matches[0] as unknown as ReferralCode;
		},

		async listCodes(params) {
			const where: Record<string, unknown> = {};
			if (params?.active !== undefined) where.active = params.active;

			const results = await data.findMany("referralCode", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as ReferralCode[];
		},

		async deactivateCode(id) {
			const existing = await data.get("referralCode", id);
			if (!existing) return null;
			const code = existing as unknown as ReferralCode;
			const updated: ReferralCode = { ...code, active: false };
			await data.upsert("referralCode", id, updated as Record<string, unknown>);
			return updated;
		},

		// ── Referrals ──────────────────────────────────────────

		async createReferral(params) {
			const codeRecord = await data.get("referralCode", params.referralCodeId);
			if (!codeRecord) return null;

			const code = codeRecord as unknown as ReferralCode;
			if (!code.active) return null;
			if (code.maxUses > 0 && code.usageCount >= code.maxUses) return null;
			if (code.expiresAt && new Date() > code.expiresAt) return null;

			// Prevent self-referral
			if (code.customerId === params.refereeCustomerId) return null;

			const id = crypto.randomUUID();
			const now = new Date();
			const referral: Referral = {
				id,
				referrerCodeId: params.referralCodeId,
				referrerCustomerId: code.customerId,
				referrerEmail: code.customerEmail,
				refereeCustomerId: params.refereeCustomerId,
				refereeEmail: params.refereeEmail,
				status: "pending",
				referrerRewarded: false,
				refereeRewarded: false,
				createdAt: now,
			};
			await data.upsert("referral", id, referral as Record<string, unknown>);

			// Increment usage count
			const updatedCode: ReferralCode = {
				...code,
				usageCount: code.usageCount + 1,
			};
			await data.upsert(
				"referralCode",
				code.id,
				updatedCode as Record<string, unknown>,
			);

			return referral;
		},

		async getReferral(id) {
			const raw = await data.get("referral", id);
			if (!raw) return null;
			return raw as unknown as Referral;
		},

		async listReferrals(params) {
			const where: Record<string, unknown> = {};
			if (params?.referrerCustomerId)
				where.referrerCustomerId = params.referrerCustomerId;
			if (params?.refereeCustomerId)
				where.refereeCustomerId = params.refereeCustomerId;
			if (params?.status) where.status = params.status;

			const results = await data.findMany("referral", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as Referral[];
		},

		async completeReferral(id) {
			const existing = await data.get("referral", id);
			if (!existing) return null;
			const referral = existing as unknown as Referral;
			if (referral.status !== "pending") return null;

			const updated: Referral = {
				...referral,
				status: "completed",
				completedAt: new Date(),
			};
			await data.upsert("referral", id, updated as Record<string, unknown>);
			return updated;
		},

		async revokeReferral(id) {
			const existing = await data.get("referral", id);
			if (!existing) return null;
			const referral = existing as unknown as Referral;
			if (referral.status !== "pending") return null;

			const updated: Referral = { ...referral, status: "revoked" };
			await data.upsert("referral", id, updated as Record<string, unknown>);
			return updated;
		},

		async markReferrerRewarded(id) {
			const existing = await data.get("referral", id);
			if (!existing) return null;
			const referral = existing as unknown as Referral;

			const updated: Referral = { ...referral, referrerRewarded: true };
			await data.upsert("referral", id, updated as Record<string, unknown>);
			return updated;
		},

		async markRefereeRewarded(id) {
			const existing = await data.get("referral", id);
			if (!existing) return null;
			const referral = existing as unknown as Referral;

			const updated: Referral = { ...referral, refereeRewarded: true };
			await data.upsert("referral", id, updated as Record<string, unknown>);
			return updated;
		},

		// ── Reward Rules ───────────────────────────────────────

		async createRewardRule(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const rule: ReferralRewardRule = {
				id,
				name: params.name,
				referrerRewardType: params.referrerRewardType,
				referrerRewardValue: params.referrerRewardValue,
				refereeRewardType: params.refereeRewardType,
				refereeRewardValue: params.refereeRewardValue,
				minOrderAmount: params.minOrderAmount ?? 0,
				active: true,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("rewardRule", id, rule as Record<string, unknown>);
			return rule;
		},

		async getRewardRule(id) {
			const raw = await data.get("rewardRule", id);
			if (!raw) return null;
			return raw as unknown as ReferralRewardRule;
		},

		async listRewardRules(params) {
			const where: Record<string, unknown> = {};
			if (params?.active !== undefined) where.active = params.active;

			const results = await data.findMany("rewardRule", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			});
			return results as unknown as ReferralRewardRule[];
		},

		async updateRewardRule(id, params) {
			const existing = await data.get("rewardRule", id);
			if (!existing) return null;
			const rule = existing as unknown as ReferralRewardRule;

			const updated: ReferralRewardRule = {
				...rule,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.referrerRewardType !== undefined
					? { referrerRewardType: params.referrerRewardType }
					: {}),
				...(params.referrerRewardValue !== undefined
					? { referrerRewardValue: params.referrerRewardValue }
					: {}),
				...(params.refereeRewardType !== undefined
					? { refereeRewardType: params.refereeRewardType }
					: {}),
				...(params.refereeRewardValue !== undefined
					? { refereeRewardValue: params.refereeRewardValue }
					: {}),
				...(params.minOrderAmount !== undefined
					? { minOrderAmount: params.minOrderAmount }
					: {}),
				...(params.active !== undefined ? { active: params.active } : {}),
				updatedAt: new Date(),
			};
			await data.upsert("rewardRule", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteRewardRule(id) {
			const existing = await data.get("rewardRule", id);
			if (!existing) return false;
			await data.delete("rewardRule", id);
			return true;
		},

		// ── Stats ──────────────────────────────────────────────

		async getStats() {
			const codes = await data.findMany("referralCode", {});
			const referrals = await data.findMany("referral", {});
			const typedReferrals = referrals as unknown as Referral[];

			const completed = typedReferrals.filter(
				(r) => r.status === "completed",
			).length;
			const pending = typedReferrals.filter(
				(r) => r.status === "pending",
			).length;

			const stats: ReferralStats = {
				totalCodes: codes.length,
				totalReferrals: typedReferrals.length,
				completedReferrals: completed,
				pendingReferrals: pending,
				conversionRate:
					typedReferrals.length > 0 ? completed / typedReferrals.length : 0,
			};
			return stats;
		},

		async getStatsForCustomer(customerId) {
			const codeMatches = await data.findMany("referralCode", {
				where: { customerId },
				take: 1,
			});
			const code =
				codeMatches.length > 0
					? (codeMatches[0] as unknown as ReferralCode)
					: null;

			const referrals = await data.findMany("referral", {
				where: { referrerCustomerId: customerId },
			});
			const typedReferrals = referrals as unknown as Referral[];

			return {
				code,
				totalReferrals: typedReferrals.length,
				completedReferrals: typedReferrals.filter(
					(r) => r.status === "completed",
				).length,
				pendingReferrals: typedReferrals.filter((r) => r.status === "pending")
					.length,
			};
		},
	};
}
