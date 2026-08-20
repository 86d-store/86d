import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { LabelType, ProductLabelController } from "../../service";

export const listLabels = createStoreEndpoint(
	"/product-labels",
	{
		method: "GET",
		query: z.object({
			type: z
				.enum(["badge", "tag", "ribbon", "banner", "sticker", "custom"])
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productLabels as ProductLabelController;

		const labels = await controller.listLabels({
			type: ctx.query.type as LabelType | undefined,
			isActive: true,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});

		return { labels };
	},
);
