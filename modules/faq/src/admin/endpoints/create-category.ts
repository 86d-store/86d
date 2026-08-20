import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FaqController } from "../../service";

export const createCategory = createAdminEndpoint(
	"/admin/faq/categories/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1),
			slug: z.string().min(1),
			description: z.string().optional(),
			icon: z.string().optional(),
			position: z.number().optional(),
		}),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;

		const category = await faqController.createCategory(ctx.body);

		return { category };
	},
);
