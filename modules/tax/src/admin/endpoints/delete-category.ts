import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TaxController } from "../../service";

export const adminDeleteCategory = createAdminEndpoint(
	"/admin/tax/categories/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const deleted = await controller.deleteCategory(ctx.params.id);
		if (!deleted) {
			return { error: "Tax category not found", status: 404 };
		}
		return { success: true };
	},
);
