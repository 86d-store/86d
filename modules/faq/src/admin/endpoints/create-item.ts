import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FaqController } from "../../service";

export const createItem = createAdminEndpoint(
	"/admin/faq/items/create",
	{
		method: "POST",
		body: z.object({
			categoryId: z.string().min(1),
			question: z.string().min(1),
			answer: z.string().min(1),
			slug: z.string().min(1),
			position: z.number().optional(),
			tags: z.array(z.string()).optional(),
		}),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;

		const item = await faqController.createItem(ctx.body);

		return { item };
	},
);
