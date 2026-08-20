import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";

export const updateCollection = createAdminEndpoint(
	"/admin/products/collections/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			slug: z.string().min(1).max(200).optional(),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			image: z.string().max(2000).optional(),
			isFeatured: z.boolean().optional(),
			isVisible: z.boolean().optional(),
			position: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const collection = await ctx.context.controllers.collection.update(ctx);
		return { collection };
	},
);
