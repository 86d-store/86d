import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuctionController } from "../../service";

export const publishAuction = createAdminEndpoint(
	"/admin/auctions/:id/publish",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.auctions as AuctionController;
		const auction = await controller.publishAuction(ctx.params.id);
		if (!auction) {
			return { error: "Auction not found", status: 404 };
		}
		void ctx.context.events?.emit("auction.published", {
			auctionId: auction.id,
			title: auction.title,
			startsAt: auction.startsAt,
			endsAt: auction.endsAt,
		});
		return { auction };
	},
);
