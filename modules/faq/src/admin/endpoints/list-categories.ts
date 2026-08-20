import { createAdminEndpoint } from "@86d-app/core/api";
import type { FaqController } from "../../service";

export const listCategories = createAdminEndpoint(
	"/admin/faq/categories",
	{
		method: "GET",
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;
		const categories = await faqController.listCategories();

		// Attach item counts
		const withCounts = await Promise.all(
			categories.map(async (cat) => {
				const items = await faqController.listItems({
					categoryId: cat.id,
				});
				return { ...cat, itemCount: items.length };
			}),
		);

		return { categories: withCounts };
	},
);
