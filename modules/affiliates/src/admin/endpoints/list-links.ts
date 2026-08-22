import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AffiliateController } from "../../service";

export const listLinksEndpoint = createAdminEndpoint(
	"/admin/affiliates/links",
	{
		method: "GET",
		query: z.object({
			affiliateId: z.string().optional(),
			active: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.affiliates as AffiliateController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listLinks({
			affiliateId: ctx.query.affiliateId,
			active: ctx.query.active,
		});
		const total = all.length;
		const links = all.slice(skip, skip + limit);
		return { links, total };
	},
);
