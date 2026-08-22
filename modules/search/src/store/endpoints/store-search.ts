import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { SearchController } from "../../service";

export const storeSearch = createStoreEndpoint(
	"/search/store-search",
	{
		method: "GET",
		query: z.object({
			q: z.string().min(0).max(500).transform(sanitizeText),
			limit: z.string().max(10).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : 5;
		const q = ctx.query.q.trim();

		if (q.length === 0) {
			return {
				results: [
					{
						id: "search",
						label: "Search",
						href: "/search",
						group: "Pages",
					},
				],
			};
		}

		const { results } = await controller.search(q, { limit });
		return {
			results: results.map((r) => ({
				id: r.item.id,
				label: r.item.title,
				href: r.item.url,
				group: r.item.entityType,
			})),
		};
	},
);
