import { createAdminEndpoint } from "@86d-app/core/api";
import type { BrandController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/brands/stats",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;
		const stats = await controller.getStats();
		return { stats };
	},
);
