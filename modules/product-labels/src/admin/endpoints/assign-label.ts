import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { LabelPosition, ProductLabelController } from "../../service";

export const assignLabel = createAdminEndpoint(
	"/admin/product-labels/assign",
	{
		method: "POST",
		body: z.object({
			productId: z.string(),
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
			const assignment = await controller.assignLabel({
				productId: ctx.body.productId,
				labelId: ctx.body.labelId,
				position: ctx.body.position as LabelPosition | undefined,
			});
			return { assignment };
		} catch {
			return { error: "Failed to assign label", status: 400 };
		}
	},
);
