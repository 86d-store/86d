import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";

export const deleteCategory = createAdminEndpoint(
	"/admin/categories/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controllers = ctx.context.controllers;

		// Check if category exists
		const existingCategory = await controllers.category.getById(ctx);
		if (!existingCategory) {
			return {
				error: "Category not found",
				status: 404,
			};
		}

		await controllers.category.delete(ctx);

		return { success: true, message: "Category deleted successfully" };
	},
);
