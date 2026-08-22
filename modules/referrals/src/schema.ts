import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const referralsReferralCodeShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string(),
	customerEmail: z.string().optional(),
	code: z.string(),
	active: z.boolean().default(true),
	usageCount: z.int().default(0),
	maxUses: z.int().default(0),
	expiresAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const referralsReferralShape = z.object({
	id: z.string().register(col, { pk: true }),
	referrerCodeId: z.string(),
	referrerCustomerId: z.string(),
	referrerEmail: z.string().optional(),
	refereeCustomerId: z.string(),
	refereeEmail: z.string(),
	status: z.string().default("pending"),
	referrerRewarded: z.boolean().default(false),
	refereeRewarded: z.boolean().default(false),
	completedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const referralsRewardRuleShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	referrerRewardType: z.string(),
	referrerRewardValue: z.number(),
	refereeRewardType: z.string(),
	refereeRewardValue: z.number(),
	minOrderAmount: z.int().default(0),
	active: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for referrals. */
export const referralsStorage = {
	kind: "relational",
	tables: {
		referralCode: {
			shape: referralsReferralCodeShape,
		},
		referral: {
			shape: referralsReferralShape,
		},
		rewardRule: {
			shape: referralsRewardRuleShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
