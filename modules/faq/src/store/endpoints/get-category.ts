import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FaqController } from "../../service";

export const getCategory = createStoreEndpoint(
	"/faq/categories/:slug",
	{
		method: "GET",
		params: z.object({
			slug: z.string().max(200),
		}),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;

		const category = await faqController.getCategoryBySlug(ctx.params.slug);
		if (!category?.isVisible) {
			return { error: "Category not found", status: 404 };
		}

		const items = await faqController.listItems({
			categoryId: category.id,
			visibleOnly: true,
		});

		return { category, items };
	},
);
