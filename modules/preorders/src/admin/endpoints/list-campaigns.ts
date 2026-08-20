import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PreordersController } from "../../service";

export const listCampaignsAdmin = createAdminEndpoint(
	"/admin/preorders/campaigns",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum(["draft", "active", "paused", "completed", "cancelled"])
				.optional(),
			productId: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.listCampaigns({
			status: ctx.query.status,
			productId: ctx.query.productId,
		});
		const total = all.length;
		const campaigns = all.slice(skip, skip + take);
		return { campaigns, total };
	},
);
