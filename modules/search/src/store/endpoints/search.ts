import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { SearchController, SearchSortField } from "../../service";

const sortFields = [
	"relevance",
	"newest",
	"oldest",
	"title_asc",
	"title_desc",
] as const;

export const searchEndpoint = createStoreEndpoint(
	"/search",
	{
		method: "GET",
		query: z.object({
			q: z.string().min(1).max(500).transform(sanitizeText),
			type: z.string().max(100).transform(sanitizeText).optional(),
			tags: z.string().max(2000).transform(sanitizeText).optional(),
			sort: z.enum(sortFields).optional(),
			fuzzy: z.coerce.boolean().optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
			sessionId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const parsedTags = ctx.query.tags
			? ctx.query.tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean)
			: undefined;

		const { results, total, facets, didYouMean } = await controller.search(
			ctx.query.q,
			{
				entityType: ctx.query.type,
				tags: parsedTags,
				sort: ctx.query.sort as SearchSortField | undefined,
				fuzzy: ctx.query.fuzzy,
				limit: ctx.query.limit ?? 20,
				skip: ctx.query.skip ?? 0,
			},
		);

		// Record query for analytics (fire-and-forget)
		controller
			.recordQuery(ctx.query.q, total, ctx.query.sessionId)
			.catch(() => {});

		return {
			results: results.map((r) => ({
				id: r.item.id,
				entityType: r.item.entityType,
				entityId: r.item.entityId,
				title: r.item.title,
				url: r.item.url,
				image: r.item.image,
				tags: r.item.tags,
				score: r.score,
				highlights: r.highlights,
			})),
			total,
			facets,
			didYouMean,
		};
	},
);
