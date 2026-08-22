import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GiftRegistryController } from "../../service";

export const archiveRegistry = createAdminEndpoint(
	"/admin/gift-registry/:id/archive",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const registry = await controller.archiveRegistry(ctx.params.id);
		if (!registry) {
			return { error: "Registry not found", status: 404 };
		}
		return { registry };
	},
);
