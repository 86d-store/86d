import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftRegistryController } from "../../service";

export const getRegistry = createStoreEndpoint(
	"/gift-registry/:slug",
	{
		method: "GET",
		params: z.object({ slug: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const registry = await controller.getRegistryBySlug(ctx.params.slug);
		if (!registry) {
			return { error: "Registry not found", status: 404 };
		}

		// Private registries require the owner to be logged in
		if (registry.visibility === "private") {
			const userId = ctx.context.session?.user?.id;
			if (userId !== registry.customerId) {
				return { error: "Registry not found", status: 404 };
			}
		}

		const items = await controller.listItems(registry.id);
		return { registry, items };
	},
);
