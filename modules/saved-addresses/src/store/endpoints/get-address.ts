import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SavedAddressesController } from "../../service";

export const getAddress = createStoreEndpoint(
	"/addresses/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.savedAddresses as SavedAddressesController;
		const address = await controller.getById(customerId, ctx.params.id);

		if (!address) {
			return { error: "Address not found", status: 404 };
		}

		return { address };
	},
);
