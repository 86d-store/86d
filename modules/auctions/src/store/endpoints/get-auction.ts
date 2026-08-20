import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuctionController } from "../../service";

export const getAuction = createStoreEndpoint(
	"/auctions/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.auctions as AuctionController;
		const auction = await controller.getAuction(ctx.params.id);
		if (!auction) {
			return { error: "Auction not found", status: 404 };
		}
		return { auction };
	},
);
