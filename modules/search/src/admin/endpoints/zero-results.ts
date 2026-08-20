import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SearchController } from "../../service";

export const zeroResultsEndpoint = createAdminEndpoint(
	"/admin/search/zero-results",
	{
		method: "GET",
		query: z.object({
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const terms = await controller.getZeroResultQueries(ctx.query.limit ?? 20);
		return { terms };
	},
);
