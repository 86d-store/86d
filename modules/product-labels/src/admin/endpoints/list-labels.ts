import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { LabelType, ProductLabelController } from "../../service";

export const adminListLabels = createAdminEndpoint(
	"/admin/product-labels",
	{
		method: "GET",
		query: z.object({
			type: z
				.enum(["badge", "tag", "ribbon", "banner", "sticker", "custom"])
				.optional(),
			isActive: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			take: z.coerce.number().int().min(1).max(200).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productLabels as ProductLabelController;

		const [labels, total] = await Promise.all([
			controller.listLabels({
				type: ctx.query.type as LabelType | undefined,
				isActive: ctx.query.isActive,
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countLabels({
				type: ctx.query.type as LabelType | undefined,
				isActive: ctx.query.isActive,
			}),
		]);

		return { labels, total };
	},
);
