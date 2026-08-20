import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuctionController } from "../../service";

export const placeBid = createStoreEndpoint(
	"/auctions/bids/place",
	{
		method: "POST",
		body: z.object({
			auctionId: z.string().max(200),
			amount: z.number().int().min(1),
			maxAutoBid: z.number().int().min(1).optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.auctions as AuctionController;
		const result = await controller.placeBid({
			auctionId: ctx.body.auctionId,
			customerId: userId,
			customerName: ctx.context.session?.user?.name,
			amount: ctx.body.amount,
			maxAutoBid: ctx.body.maxAutoBid,
		});

		void ctx.context.events?.emit("bid.placed", {
			bidId: result.bid.id,
			auctionId: result.bid.auctionId,
			customerId: result.bid.customerId,
			amount: result.bid.amount,
			currentHighest: result.auction.currentBid,
		});

		if (result.outbidPreviousHighest) {
			void ctx.context.events?.emit("bid.outbid", {
				auctionId: result.bid.auctionId,
				newBidAmount: result.bid.amount,
			});
		}

		return { result };
	},
);
