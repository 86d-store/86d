import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { StoreLocatorController } from "../../service";

export const deleteLocation = createAdminEndpoint(
	"/admin/store-locator/locations/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storeLocator as StoreLocatorController;

		await controller.deleteLocation(ctx.params.id);

		return { success: true };
	},
);
