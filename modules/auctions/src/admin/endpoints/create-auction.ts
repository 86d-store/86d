import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuctionController } from "../../service";

export const createAuction = createAdminEndpoint(
	"/admin/auctions/create",
	{
		method: "POST",
		body: z.object({
			title: z.string().min(1).max(200),
			description: z.string().max(5000).optional(),
			productId: z.string(),
			productName: z.string().min(1).max(200),
			imageUrl: z.string().url().optional(),
			type: z.enum(["english", "dutch", "sealed"]),
			startingPrice: z.number().int().min(1),
			reservePrice: z.number().int().min(0).optional(),
			buyNowPrice: z.number().int().min(0).optional(),
			bidIncrement: z.number().int().min(1).optional(),
			priceDropAmount: z.number().int().min(1).optional(),
			priceDropIntervalMinutes: z.number().int().min(1).optional(),
			startsAt: z.coerce.date(),
			endsAt: z.coerce.date(),
			antiSnipingEnabled: z.boolean().optional(),
			antiSnipingMinutes: z.number().int().min(1).max(60).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.auctions as AuctionController;
		const auction = await controller.createAuction(ctx.body);
		return { auction };
	},
);
