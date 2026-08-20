import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AffiliateController, ConversionStatus } from "../../service";

export const listConversionsEndpoint = createAdminEndpoint(
	"/admin/affiliates/conversions",
	{
		method: "GET",
		query: z.object({
			affiliateId: z.string().optional(),
			status: z.enum(["pending", "approved", "rejected"]).optional(),
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
		const all = await controller.listConversions({
			affiliateId: ctx.query.affiliateId,
			status: ctx.query.status as ConversionStatus | undefined,
		});
		const total = all.length;
		const conversions = all.slice(skip, skip + limit);
		return { conversions, total };
	},
);
