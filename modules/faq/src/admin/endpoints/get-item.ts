import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FaqController } from "../../service";

export const getItem = createAdminEndpoint(
	"/admin/faq/items/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;

		const item = await faqController.getItem(ctx.params.id);
		if (!item) {
			return { error: "FAQ item not found", status: 404 };
		}

		return { item };
	},
);
