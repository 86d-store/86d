import { createAdminEndpoint } from "@86d-app/core/api";
import type { ReturnController } from "../../service";

export const returnSummary = createAdminEndpoint(
	"/admin/returns/summary",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.returns as ReturnController;
		const summary = await controller.getSummary();
		return { summary };
	},
);
