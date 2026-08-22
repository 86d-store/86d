import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { TaxController } from "../../service";

export const adminCreateCategory = createAdminEndpoint(
	"/admin/tax/categories/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(100).transform(sanitizeText),
			description: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const category = await controller.createCategory(ctx.body);
		return { category };
	},
);
