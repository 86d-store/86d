import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AuctionController } from "../../service";

export const listAuctions = createAdminEndpoint(
	"/admin/auctions",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum(["draft", "scheduled", "active", "ended", "sold", "cancelled"])
				.optional(),
			type: z.enum(["english", "dutch", "sealed"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.auctions as AuctionController;
		const auctions = await controller.listAuctions({
			status: ctx.query.status,
			type: ctx.query.type,
			take: ctx.query.take ?? 20,
			skip: ctx.query.skip,
		});
		return { auctions };
	},
);
