import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FaqController } from "../../service";

export const getItem = createStoreEndpoint(
	"/faq/items/:slug",
	{
		method: "GET",
		params: z.object({
			slug: z.string().max(200),
		}),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;

		const item = await faqController.getItemBySlug(ctx.params.slug);
		if (!item?.isVisible) {
			return { error: "FAQ item not found", status: 404 };
		}

		return { item };
	},
);
