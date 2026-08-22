import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { RecommendationController } from "../../service";

export const listRules = createAdminEndpoint(
	"/admin/recommendations/rules",
	{
		method: "GET",
		query: z.object({
			strategy: z
				.enum(["manual", "bought_together", "trending", "personalized"])
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
			.recommendations as RecommendationController;

		const [rules, total] = await Promise.all([
			controller.listRules({
				strategy: ctx.query.strategy,
				isActive: ctx.query.isActive,
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countRules({
				strategy: ctx.query.strategy,
				isActive: ctx.query.isActive,
			}),
		]);

		return { rules, total };
	},
);
