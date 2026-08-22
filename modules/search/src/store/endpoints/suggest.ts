import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { SearchController } from "../../service";

export const suggestEndpoint = createStoreEndpoint(
	"/search/suggest",
	{
		method: "GET",
		query: z.object({
			q: z.string().min(1).max(200).transform(sanitizeText),
			limit: z.coerce.number().int().min(1).max(20).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const suggestions = await controller.suggest(
			ctx.query.q,
			ctx.query.limit ?? 8,
		);
		return { suggestions };
	},
);
