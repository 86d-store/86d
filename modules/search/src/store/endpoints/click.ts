import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { SearchController } from "../../service";

export const clickEndpoint = createStoreEndpoint(
	"/search/click",
	{
		method: "POST",
		body: z.object({
			queryId: z.string().min(1).max(200),
			term: z.string().min(1).max(500).transform(sanitizeText),
			entityType: z.string().min(1).max(100).transform(sanitizeText),
			entityId: z.string().min(1).max(200),
			position: z.number().int().min(0).max(1000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const click = await controller.recordClick(ctx.body);
		return { id: click.id };
	},
);
