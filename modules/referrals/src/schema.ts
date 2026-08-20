import type { ModuleSchema } from "@86d-app/core/types/schema";

export const referralsSchema = {
	referralCode: {
		fields: {
			id: { type: "string", required: true },
			customerId: { type: "string", required: true },
			customerEmail: { type: "string", required: false },
			code: { type: "string", required: true },
			active: { type: "boolean", required: true, defaultValue: true },
			usageCount: { type: "number", required: true, defaultValue: 0 },
			maxUses: { type: "number", required: true, defaultValue: 0 },
			expiresAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	referral: {
		fields: {
			id: { type: "string", required: true },
			referrerCodeId: { type: "string", required: true },
			referrerCustomerId: { type: "string", required: true },
			referrerEmail: { type: "string", required: false },
			refereeCustomerId: { type: "string", required: true },
			refereeEmail: { type: "string", required: true },
			status: {
				type: "string",
				required: true,
				defaultValue: "pending",
			},
			referrerRewarded: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			refereeRewarded: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			completedAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	rewardRule: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			referrerRewardType: { type: "string", required: true },
			referrerRewardValue: { type: "number", required: true },
			refereeRewardType: { type: "string", required: true },
			refereeRewardValue: { type: "number", required: true },
			minOrderAmount: { type: "number", required: true, defaultValue: 0 },
			active: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
