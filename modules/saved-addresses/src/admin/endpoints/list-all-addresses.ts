import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SavedAddressesController } from "../../service";

export const listAllAddresses = createAdminEndpoint(
	"/admin/saved-addresses",
	{
		method: "GET",
		query: z.object({
			customerId: z.string().max(200).optional(),
			country: z.string().max(2).optional(),
			take: z.coerce.number().min(1).max(100).optional(),
			skip: z.coerce.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.savedAddresses as SavedAddressesController;
		const result = await controller.listAll({
			customerId: ctx.query.customerId,
			country: ctx.query.country,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
		return result;
	},
);
