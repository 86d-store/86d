import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SavedAddressesController } from "../../service";

export const listAddresses = createStoreEndpoint(
	"/addresses",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().min(1).max(50).optional(),
			skip: z.coerce.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.savedAddresses as SavedAddressesController;
		const addresses = await controller.listByCustomer(customerId, {
			take: ctx.query.take,
			skip: ctx.query.skip,
		});

		return { addresses };
	},
);
