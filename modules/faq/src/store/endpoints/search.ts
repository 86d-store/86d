import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { FaqController } from "../../service";

export const searchFaqs = createStoreEndpoint(
	"/faq/search",
	{
		method: "GET",
		query: z.object({
			q: z.string().max(500).transform(sanitizeText),
			categoryId: z.string().max(200).optional(),
			limit: z.string().max(5).optional(),
		}),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;
		const { q, categoryId, limit } = ctx.query;

		const items = await faqController.search(q, {
			categoryId,
			limit: limit ? Number.parseInt(limit, 10) : 20,
		});

		return { items, query: q };
	},
);
