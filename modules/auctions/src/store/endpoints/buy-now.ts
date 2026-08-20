import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuctionController } from "../../service";

export const buyNow = createStoreEndpoint(
	"/auctions/buy-now",
	{
		method: "POST",
		body: z.object({
			auctionId: z.string().max(200),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.auctions as AuctionController;
		const auction = await controller.buyNow({
			auctionId: ctx.body.auctionId,
			customerId: userId,
		});

		void ctx.context.events?.emit("auction.buy_now", {
			auctionId: auction.id,
			buyerId: userId,
			price: auction.buyNowPrice ?? auction.currentBid,
		});
		void ctx.context.events?.emit("auction.sold", {
			auctionId: auction.id,
			title: auction.title,
			winnerId: userId,
			salePrice: auction.buyNowPrice ?? auction.currentBid,
		});

		return { auction };
	},
);
