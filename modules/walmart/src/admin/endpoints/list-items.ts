import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type {
	FulfillmentType,
	ItemStatus,
	WalmartController,
} from "../../service";

export const listItemsEndpoint = createAdminEndpoint(
	"/admin/walmart/items",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum(["published", "unpublished", "retired", "system-error"])
				.optional(),
			fulfillmentType: z.enum(["seller", "wfs"]).optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.walmart as WalmartController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listItems({
			status: ctx.query.status as ItemStatus | undefined,
			fulfillmentType: ctx.query.fulfillmentType as FulfillmentType | undefined,
		});
		const total = all.length;
		const items = all.slice(skip, skip + limit);
		return { items, total };
	},
);
