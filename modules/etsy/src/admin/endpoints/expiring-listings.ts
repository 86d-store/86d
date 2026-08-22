import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { EtsyController } from "../../service";

export const expiringListingsEndpoint = createAdminEndpoint(
	"/admin/etsy/listings/expiring",
	{
		method: "GET",
		query: z.object({
			days: z.coerce.number().int().min(1).max(365).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.etsy as EtsyController;
		const daysAhead = ctx.query.days ?? 30;
		const listings = await controller.getExpiringListings(daysAhead);
		return { listings, total: listings.length };
	},
);
