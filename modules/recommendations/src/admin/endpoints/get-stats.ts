import { createAdminEndpoint } from "@86d-app/core/api";
import type { RecommendationController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/recommendations/stats",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;

		const stats = await controller.getStats();

		return { stats };
	},
);
