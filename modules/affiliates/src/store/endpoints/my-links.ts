import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AffiliateController } from "../../service";

export const myLinksEndpoint = createStoreEndpoint(
	"/affiliates/my-links",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers
			.affiliates as AffiliateController;

		const affiliates = await controller.listAffiliates();
		const affiliate = affiliates.find((a) => a.customerId === customerId);
		if (!affiliate) return { error: "Not an affiliate", status: 404 };

		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;

		const links = await controller.listLinks({
			affiliateId: affiliate.id,
			take: limit,
			skip,
		});
		return { links, total: links.length };
	},
);
