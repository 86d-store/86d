import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { RecommendationController } from "../../service";

export const deleteRule = createAdminEndpoint(
	"/admin/recommendations/rules/:id/delete",
	{ method: "POST", params: z.object({ id: z.string().max(200) }) },
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;

		const deleted = await controller.deleteRule(ctx.params.id);

		if (!deleted) {
			return { error: "Rule not found", status: 404 };
		}

		return { success: true };
	},
);
