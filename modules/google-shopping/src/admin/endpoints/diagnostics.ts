import { createAdminEndpoint } from "@86d-app/core/api";
import type { GoogleShoppingController } from "../../service";

export const diagnosticsEndpoint = createAdminEndpoint(
	"/admin/google-shopping/diagnostics",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"google-shopping"
		] as GoogleShoppingController;
		const diagnostics = await controller.getDiagnostics();
		return { diagnostics };
	},
);
