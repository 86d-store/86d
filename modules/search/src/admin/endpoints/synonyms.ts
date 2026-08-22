import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SearchController } from "../../service";

export const listSynonyms = createAdminEndpoint(
	"/admin/search/synonyms",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const synonyms = await controller.listSynonyms();
		return { synonyms };
	},
);

export const addSynonym = createAdminEndpoint(
	"/admin/search/synonyms/add",
	{
		method: "POST",
		body: z.object({
			term: z.string().min(1).max(200),
			synonyms: z.array(z.string().min(1).max(200)).min(1).max(50),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const synonym = await controller.addSynonym(
			ctx.body.term,
			ctx.body.synonyms,
		);
		return { synonym };
	},
);

export const removeSynonym = createAdminEndpoint(
	"/admin/search/synonyms/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const removed = await controller.removeSynonym(ctx.params.id);
		if (!removed) {
			return { error: "Synonym not found", status: 404 };
		}
		return { success: true };
	},
);
