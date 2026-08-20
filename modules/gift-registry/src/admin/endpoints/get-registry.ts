import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftRegistryController } from "../../service";

export const getRegistry = createAdminEndpoint(
	"/admin/gift-registry/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const registry = await controller.getRegistry(ctx.params.id);
		if (!registry) {
			return { error: "Registry not found", status: 404 };
		}

		const items = await controller.listItems(ctx.params.id);
		const purchases = await controller.listPurchases(ctx.params.id, {
			take: 20,
		});

		return { registry, items, recentPurchases: purchases };
	},
);
