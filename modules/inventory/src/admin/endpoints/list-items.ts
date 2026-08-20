import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InventoryController } from "../../service";

export const listItems = createAdminEndpoint(
	"/admin/inventory",
	{
		method: "GET",
		query: z.object({
			productId: z.string().optional(),
			locationId: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.inventory as InventoryController;
		const items = await controller.listItems({
			productId: ctx.query.productId,
			locationId: ctx.query.locationId,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});
		return { items };
	},
);
