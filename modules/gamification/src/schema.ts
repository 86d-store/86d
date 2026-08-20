import type { ModuleSchema } from "@86d-app/core/types/schema";

export const gamificationSchema = {
	game: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			type: { type: "string", required: true, defaultValue: "wheel" },
			isActive: { type: "boolean", required: true, defaultValue: true },
			requireEmail: { type: "boolean", required: true, defaultValue: true },
			requireNewsletterOptIn: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			maxPlaysPerUser: { type: "number", required: true, defaultValue: 1 },
			cooldownMinutes: { type: "number", required: true, defaultValue: 1440 },
			totalPlays: { type: "number", required: true, defaultValue: 0 },
			totalWins: { type: "number", required: true, defaultValue: 0 },
			startDate: { type: "date", required: false },
			endDate: { type: "date", required: false },
			settings: { type: "json", required: true, defaultValue: {} },
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
	prize: {
		fields: {
			id: { type: "string", required: true },
			gameId: { type: "string", required: true },
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			type: {
				type: "string",
				required: true,
				defaultValue: "discount-percent",
			},
			value: { type: "string", required: true },
			probability: { type: "number", required: true },
			maxWins: { type: "number", required: true, defaultValue: -1 },
			currentWins: { type: "number", required: true, defaultValue: 0 },
			discountCode: { type: "string", required: false },
			productId: { type: "string", required: false },
			isActive: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	play: {
		fields: {
			id: { type: "string", required: true },
			gameId: { type: "string", required: true },
			email: { type: "string", required: false },
			customerId: { type: "string", required: false },
			result: { type: "string", required: true },
			prizeId: { type: "string", required: false },
			prizeName: { type: "string", required: false },
			prizeValue: { type: "string", required: false },
			isRedeemed: { type: "boolean", required: true, defaultValue: false },
			redeemedAt: { type: "date", required: false },
			ipAddress: { type: "string", required: false },
			userAgent: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
