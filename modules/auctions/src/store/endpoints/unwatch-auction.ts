import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AuctionController } from "../../service";

export const unwatchAuction = createStoreEndpoint(
	"/auctions/unwatch",
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
		const removed = await controller.unwatchAuction(ctx.body.auctionId, userId);

		return { removed };
	},
);
