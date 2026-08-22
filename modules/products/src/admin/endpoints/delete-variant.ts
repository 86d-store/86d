import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const deleteVariant = createAdminEndpoint(
	"/admin/variants/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controllers = ctx.context.controllers;

		// Check if variant exists
		const existingVariant = await controllers.variant.getById(ctx);
		if (!existingVariant) {
			return {
				error: "Variant not found",
				status: 404,
			};
		}

		await controllers.variant.delete(ctx);

		return { success: true, message: "Variant deleted successfully" };
	},
);
