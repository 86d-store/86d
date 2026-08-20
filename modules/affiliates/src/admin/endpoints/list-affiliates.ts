import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AffiliateController, AffiliateStatus } from "../../service";

export const listAffiliatesEndpoint = createAdminEndpoint(
	"/admin/affiliates",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum(["pending", "approved", "suspended", "rejected"])
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
		const affiliates = await controller.listAffiliates({
			status: ctx.query.status as AffiliateStatus | undefined,
			take: limit,
			skip,
		});
		return { affiliates, total: affiliates.length };
	},
);
