import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FaqController } from "../../service";

export const listItems = createAdminEndpoint(
	"/admin/faq/items",
	{
		method: "GET",
		query: z
			.object({
				categoryId: z.string().optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;
		const { query = {} } = ctx;

		const items = await faqController.listItems({
			categoryId: query.categoryId,
		});

		return { items };
	},
);
