import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SeoController } from "../../service";

export const listMetaEndpoint = createAdminEndpoint(
	"/admin/seo/meta",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.seo as SeoController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listMetaTags({});
		const total = all.length;
		const metaTags = all.slice(skip, skip + limit);
		return { metaTags, total };
	},
);
