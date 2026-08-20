import { createStoreEndpoint } from "@86d-app/core/api";
import type { GiftRegistryController } from "../../service";

export const myRegistries = createStoreEndpoint(
	"/gift-registry/mine",
	{
		method: "GET",
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const registries = await controller.getCustomerRegistries(userId);
		return { registries };
	},
);
