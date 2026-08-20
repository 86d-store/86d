import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FavorController } from "../../service";

export const listServiceAreas = createAdminEndpoint(
	"/admin/favor/service-areas",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.favor as FavorController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;

		// Fetch all for accurate total, then slice for page
		const all = await controller.listServiceAreas({});
		const total = all.length;
		const areas = all.slice(skip, skip + take);
		return { areas, total };
	},
);
