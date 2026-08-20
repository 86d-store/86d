import { createStoreEndpoint } from "@86d-app/core/api";
import type { FaqController } from "../../service";

export const listCategories = createStoreEndpoint(
	"/faq/categories",
	{
		method: "GET",
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;
		const categories = await faqController.listCategories({
			visibleOnly: true,
		});

		return { categories };
	},
);
