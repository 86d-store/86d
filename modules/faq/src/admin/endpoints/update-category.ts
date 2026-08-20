import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FaqController } from "../../service";

export const updateCategory = createAdminEndpoint(
	"/admin/faq/categories/:id",
	{
		method: "PUT",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			name: z.string().min(1).optional(),
			slug: z.string().min(1).optional(),
			description: z.string().optional(),
			icon: z.string().optional(),
			position: z.number().optional(),
			isVisible: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;

		const category = await faqController.updateCategory(
			ctx.params.id,
			ctx.body,
		);

		return { category };
	},
);
