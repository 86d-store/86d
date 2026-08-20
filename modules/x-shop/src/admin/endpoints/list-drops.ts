import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { XShopController } from "../../service";

export const listDropsEndpoint = createAdminEndpoint(
	"/admin/x-shop/drops",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["scheduled", "live", "ended", "cancelled"]).optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const limit = ctx.query.limit ?? 20;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listDrops({
			status: ctx.query.status,
		});
		const total = all.length;
		const drops = all.slice(skip, skip + limit);
		return { drops, total };
	},
);
