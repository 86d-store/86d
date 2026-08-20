import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuctionController } from "../../service";

export const myBids = createStoreEndpoint(
	"/auctions/my-bids",
	{
		method: "GET",
		query: z.object({
			auctionId: z.string().max(200).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.auctions as AuctionController;
		const bids = await controller.getBidsByCustomer(userId, {
			auctionId: ctx.query.auctionId,
			take: ctx.query.take ?? 20,
			skip: ctx.query.skip,
		});

		return { bids };
	},
);
