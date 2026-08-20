import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductLabelController } from "../../service";

export const bulkUnassign = createAdminEndpoint(
	"/admin/product-labels/bulk-unassign",
	{
		method: "POST",
		body: z.object({
			productIds: z.array(z.string()).min(1).max(500),
			labelId: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productLabels as ProductLabelController;

		try {
			const removed = await controller.bulkUnassignLabel({
				productIds: ctx.body.productIds,
				labelId: ctx.body.labelId,
			});
			return { removed };
		} catch {
			return { error: "Failed to unassign labels", status: 400 };
		}
	},
);
