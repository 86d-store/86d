import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const gamificationGameShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	type: z.string().default("wheel"),
	isActive: z.boolean().default(true),
	requireEmail: z.boolean().default(true),
	requireNewsletterOptIn: z.boolean().default(false),
	maxPlaysPerUser: z.int().default(1),
	cooldownMinutes: z.int().default(1440),
	totalPlays: z.int().default(0),
	totalWins: z.int().default(0),
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	settings: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const gamificationPrizeShape = z.object({
	id: z.string().register(col, { pk: true }),
	gameId: z.string(),
	name: z.string(),
	description: z.string().optional(),
	type: z.string().default("discount-percent"),
	value: z.string(),
	probability: z.number(),
	maxWins: z.int().default(-1),
	currentWins: z.int().default(0),
	discountCode: z.string().optional(),
	productId: z.string().optional(),
	isActive: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const gamificationPlayShape = z.object({
	id: z.string().register(col, { pk: true }),
	gameId: z.string(),
	email: z.string().optional(),
	customerId: z.string().optional(),
	result: z.string(),
	prizeId: z.string().optional(),
	prizeName: z.string().optional(),
	prizeValue: z.string().optional(),
	isRedeemed: z.boolean().default(false),
	redeemedAt: z.coerce.date().optional(),
	ipAddress: z.string().optional(),
	userAgent: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for gamification. */
export const gamificationStorage = {
	kind: "relational",
	tables: {
		game: {
			shape: gamificationGameShape,
		},
		prize: {
			shape: gamificationPrizeShape,
		},
		play: {
			shape: gamificationPlayShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
