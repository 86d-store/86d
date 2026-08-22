import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AuctionController } from "../../service";

export const listBids = createStoreEndpoint(
	"/auctions/:id/bids",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.auctions as AuctionController;
		const bids = await controller.listBids(ctx.params.id, {
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip,
		});
		return { bids };
	},
);
