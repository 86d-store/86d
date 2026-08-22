import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductLabelController } from "../../service";

export const deleteLabel = createAdminEndpoint(
	"/admin/product-labels/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productLabels as ProductLabelController;

		const deleted = await controller.deleteLabel(ctx.params.id);
		if (!deleted) {
			return { error: "Label not found", status: 404 };
		}

		return { success: true };
	},
);
