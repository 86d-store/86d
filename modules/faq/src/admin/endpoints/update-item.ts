import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FaqController } from "../../service";

export const updateItem = createAdminEndpoint(
	"/admin/faq/items/:id/update",
	{
		method: "PUT",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			categoryId: z.string().optional(),
			question: z.string().min(1).optional(),
			answer: z.string().min(1).optional(),
			slug: z.string().min(1).optional(),
			position: z.number().optional(),
			isVisible: z.boolean().optional(),
			tags: z.array(z.string()).optional(),
		}),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;

		const item = await faqController.updateItem(ctx.params.id, ctx.body);

		return { item };
	},
);
