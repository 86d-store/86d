import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuctionController } from "../../service";

export const updateAuction = createAdminEndpoint(
	"/admin/auctions/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			title: z.string().min(1).max(200).optional(),
			description: z.string().max(5000).optional(),
			imageUrl: z.string().url().optional(),
			startingPrice: z.number().int().min(1).optional(),
			reservePrice: z.number().int().min(0).optional(),
			buyNowPrice: z.number().int().min(0).optional(),
			bidIncrement: z.number().int().min(1).optional(),
			priceDropAmount: z.number().int().min(1).optional(),
			priceDropIntervalMinutes: z.number().int().min(1).optional(),
			startsAt: z.coerce.date().optional(),
			endsAt: z.coerce.date().optional(),
			antiSnipingEnabled: z.boolean().optional(),
			antiSnipingMinutes: z.number().int().min(1).max(60).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.auctions as AuctionController;
		const auction = await controller.updateAuction(ctx.params.id, ctx.body);
		if (!auction) {
			return { error: "Auction not found", status: 404 };
		}
		return { auction };
	},
);
