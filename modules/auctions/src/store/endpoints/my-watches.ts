import { createStoreEndpoint } from "@86d-app/core/api";
import type { AuctionController } from "../../service";

export const myWatches = createStoreEndpoint(
	"/auctions/my-watches",
	{
		method: "GET",
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.auctions as AuctionController;
		const watches = await controller.getWatchedAuctions(userId);

		return { watches };
	},
);
