import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RedirectController } from "../../service";

export const listRedirects = createAdminEndpoint(
	"/admin/redirects",
	{
		method: "GET",
		query: z.object({
			active: z.enum(["true", "false"]).optional(),
			statusCode: z.coerce.number().int().optional(),
			search: z.string().max(200).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.redirects as RedirectController;

		const params: Parameters<typeof controller.listRedirects>[0] = {
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		};
		if (ctx.query.active === "true") params.isActive = true;
		else if (ctx.query.active === "false") params.isActive = false;
		if (ctx.query.statusCode != null) params.statusCode = ctx.query.statusCode;
		if (ctx.query.search != null) params.search = ctx.query.search;

		const redirects = await controller.listRedirects(params);

		const countParams: Parameters<typeof controller.countRedirects>[0] = {};
		if (params.isActive != null) countParams.isActive = params.isActive;
		if (params.statusCode != null) countParams.statusCode = params.statusCode;
		if (params.search != null) countParams.search = params.search;
		const total = await controller.countRedirects(countParams);

		return { redirects, total };
	},
);
