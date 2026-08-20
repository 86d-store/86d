import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftRegistryController } from "../../service";

export const deleteRegistry = createAdminEndpoint(
	"/admin/gift-registry/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const deleted = await controller.deleteRegistry(ctx.params.id);
		if (!deleted) {
			return { error: "Registry not found", status: 404 };
		}
		return { success: true };
	},
);
