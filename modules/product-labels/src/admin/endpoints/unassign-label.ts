import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductLabelController } from "../../service";

export const unassignLabel = createAdminEndpoint(
	"/admin/product-labels/unassign",
	{
		method: "POST",
		body: z.object({
			productId: z.string(),
			labelId: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productLabels as ProductLabelController;

		const removed = await controller.unassignLabel({
			productId: ctx.body.productId,
			labelId: ctx.body.labelId,
		});

		if (!removed) {
			return { error: "Assignment not found", status: 404 };
		}

		return { success: true };
	},
);
