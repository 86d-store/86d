import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const auctionsAuctionShape = z.object({
	id: z.string().register(col, { pk: true }),
	title: z.string(),
	description: z.string().optional(),
	productId: z.string(),
	productName: z.string(),
	imageUrl: z.string().optional(),
	type: z.enum(["english", "dutch", "sealed"]),
	status: z
		.enum(["draft", "scheduled", "active", "ended", "sold", "cancelled"])
		.default("draft"),
	startingPrice: z.number(),
	reservePrice: z.int().default(0),
	buyNowPrice: z.int().default(0),
	bidIncrement: z.int().default(100),
	currentBid: z.int().default(0),
	bidCount: z.int().default(0),
	highestBidderId: z.string().optional(),
	winnerId: z.string().optional(),
	finalPrice: z.number().optional(),
	priceDropAmount: z.number().optional(),
	priceDropIntervalMinutes: z.number().optional(),
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date(),
	antiSnipingEnabled: z.boolean().default(true),
	antiSnipingMinutes: z.int().default(5),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const auctionsBidShape = z.object({
	id: z.string().register(col, { pk: true }),
	auctionId: z.string().register(col, {
		references: { table: "self.auction", column: "id", onDelete: "cascade" },
	}),
	customerId: z.string(),
	customerName: z.string().optional(),
	amount: z.number(),
	maxAutoBid: z.number().optional(),
	isWinning: z.boolean().default(false),
	isAutoBid: z.boolean().default(false),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const auctionsAuctionWatchShape = z.object({
	id: z.string().register(col, { pk: true }),
	auctionId: z.string().register(col, {
		references: { table: "self.auction", column: "id", onDelete: "cascade" },
	}),
	customerId: z.string(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for auctions. */
export const auctionsStorage = {
	kind: "relational",
	tables: {
		auction: {
			shape: auctionsAuctionShape,
		},
		bid: {
			shape: auctionsBidShape,
		},
		auctionWatch: {
			shape: auctionsAuctionWatchShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
