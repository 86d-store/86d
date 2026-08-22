import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ComparisonController } from "../../service";

export const deleteItem = createAdminEndpoint(
	"/admin/comparisons/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.comparisons as ComparisonController;

		const deleted = await controller.deleteItem(ctx.params.id);

		if (!deleted) {
			return { error: "Comparison item not found", status: 404 };
		}

		return { success: true };
	},
);
