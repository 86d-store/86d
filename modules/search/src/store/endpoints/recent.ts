import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SearchController } from "../../service";

export const recentEndpoint = createStoreEndpoint(
	"/search/recent",
	{
		method: "GET",
		query: z.object({
			sessionId: z.string().min(1).max(128),
			limit: z.coerce.number().int().min(1).max(20).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const queries = await controller.getRecentQueries(
			ctx.query.sessionId,
			ctx.query.limit ?? 10,
		);
		return {
			recent: queries.map((q) => ({
				term: q.term,
				resultCount: q.resultCount,
				searchedAt: q.searchedAt,
			})),
		};
	},
);
