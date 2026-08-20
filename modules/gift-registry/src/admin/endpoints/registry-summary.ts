import { createAdminEndpoint } from "@86d-app/core/api";
import type { GiftRegistryController } from "../../service";

export const registrySummary = createAdminEndpoint(
	"/admin/gift-registry/summary",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const summary = await controller.getRegistrySummary();
		return { summary };
	},
);
