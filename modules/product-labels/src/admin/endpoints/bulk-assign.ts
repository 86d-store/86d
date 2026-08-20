import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { LabelPosition, ProductLabelController } from "../../service";

export const bulkAssign = createAdminEndpoint(
	"/admin/product-labels/bulk-assign",
	{
		method: "POST",
		body: z.object({
			productIds: z.array(z.string()).min(1).max(500),
			labelId: z.string(),
			position: z
				.enum([
					"top-left",
					"top-right",
					"bottom-left",
					"bottom-right",
					"center",
				])
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productLabels as ProductLabelController;

		try {
			const assigned = await controller.bulkAssignLabel({
				productIds: ctx.body.productIds,
				labelId: ctx.body.labelId,
				position: ctx.body.position as LabelPosition | undefined,
			});
			return { assigned };
		} catch {
			return { error: "Failed to assign labels", status: 400 };
		}
	},
);
