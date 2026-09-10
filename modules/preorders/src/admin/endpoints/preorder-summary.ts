import { createAdminEndpoint } from "@86d-store/core/api";
import type { PreordersController } from "../../service";

export const preorderSummary = createAdminEndpoint(
	"/admin/preorders/summary",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const summary = await controller.getSummary();
		return { summary };
	},
);
