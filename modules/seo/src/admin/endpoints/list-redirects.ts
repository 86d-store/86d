import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SeoController } from "../../service";

export const listRedirectsEndpoint = createAdminEndpoint(
	"/admin/seo/redirects",
	{
		method: "GET",
		query: z.object({
			active: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.seo as SeoController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listRedirects({
			active: ctx.query.active,
		});
		const total = all.length;
		const redirects = all.slice(skip, skip + limit);
		return { redirects, total };
	},
);
