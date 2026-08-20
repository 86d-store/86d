import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductLabelController } from "../../service";

export const labelStats = createAdminEndpoint(
	"/admin/product-labels/stats",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productLabels as ProductLabelController;

		const stats = await controller.getLabelStats({
			take: ctx.query.take ?? 50,
		});

		return { stats };
	},
);
