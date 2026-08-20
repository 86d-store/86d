import { createAdminEndpoint } from "@86d-app/core/api";
import type { WaitlistController } from "../../service";

export const waitlistSummary = createAdminEndpoint(
	"/admin/waitlist/summary",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.waitlist as WaitlistController;
		const summary = await controller.getSummary();
		return { summary };
	},
);
