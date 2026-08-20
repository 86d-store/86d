import { createAdminEndpoint } from "@86d-app/core/api";
import type { GoogleShoppingController } from "../../service";

export const submitFeedEndpoint = createAdminEndpoint(
	"/admin/google-shopping/submit",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"google-shopping"
		] as GoogleShoppingController;
		const submission = await controller.submitFeed();
		return { submission };
	},
);
