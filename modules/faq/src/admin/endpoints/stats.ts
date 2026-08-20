import { createAdminEndpoint } from "@86d-app/core/api";
import type { FaqController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/faq/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;

		const stats = await faqController.getStats();

		return { stats };
	},
);
