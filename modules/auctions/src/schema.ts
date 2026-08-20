import type { ModuleSchema } from "@86d-app/core/types/schema";

export const auctionsSchema = {
	auction: {
		fields: {
			id: { type: "string", required: true },
			title: { type: "string", required: true },
			description: { type: "string", required: false },
			productId: { type: "string", required: true },
			productName: { type: "string", required: true },
			imageUrl: { type: "string", required: false },
			type: {
				type: ["english", "dutch", "sealed"] as const,
				required: true,
			},
			status: {
				type: [
					"draft",
					"scheduled",
					"active",
					"ended",
					"sold",
					"cancelled",
				] as const,
				required: true,
				defaultValue: "draft",
			},
			/** Starting bid amount in cents */
			startingPrice: { type: "number", required: true },
			/** Minimum price for item to sell (0 = no reserve) */
			reservePrice: { type: "number", required: true, defaultValue: 0 },
			/** Optional buy-it-now price in cents (0 = disabled) */
			buyNowPrice: { type: "number", required: true, defaultValue: 0 },
			/** Minimum bid increment in cents */
			bidIncrement: { type: "number", required: true, defaultValue: 100 },
			/** Current highest bid in cents */
			currentBid: { type: "number", required: true, defaultValue: 0 },
			/** Total number of bids placed */
			bidCount: { type: "number", required: true, defaultValue: 0 },
			/** ID of the current highest bidder */
			highestBidderId: { type: "string", required: false },
			/** Winner customer ID (set after auction ends) */
			winnerId: { type: "string", required: false },
			/** Final sale price in cents */
			finalPrice: { type: "number", required: false },
			/** For dutch auctions: price decreases by this amount each interval */
			priceDropAmount: { type: "number", required: false },
			/** For dutch auctions: interval in minutes between price drops */
			priceDropIntervalMinutes: { type: "number", required: false },
			startsAt: { type: "date", required: true },
			endsAt: { type: "date", required: true },
			/** Whether auction extends when bids come in near the end */
			antiSnipingEnabled: {
				type: "boolean",
				required: true,
				defaultValue: true,
			},
			/** Minutes to extend by when a last-minute bid arrives */
			antiSnipingMinutes: {
				type: "number",
				required: true,
				defaultValue: 5,
			},
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
	bid: {
		fields: {
			id: { type: "string", required: true },
			auctionId: {
				type: "string",
				required: true,
				references: {
					model: "auction",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			customerId: { type: "string", required: true },
			customerName: { type: "string", required: false },
			/** Bid amount in cents */
			amount: { type: "number", required: true },
			/** For sealed auctions: max autobid amount */
			maxAutoBid: { type: "number", required: false },
			isWinning: { type: "boolean", required: true, defaultValue: false },
			/** Whether this bid was automatically placed by the system (proxy bidding) */
			isAutoBid: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	auctionWatch: {
		fields: {
			id: { type: "string", required: true },
			auctionId: {
				type: "string",
				required: true,
				references: {
					model: "auction",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			customerId: { type: "string", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
