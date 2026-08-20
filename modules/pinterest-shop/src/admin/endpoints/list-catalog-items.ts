import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type {
	Availability,
	CatalogItemStatus,
	PinterestShopController,
} from "../../service";

export const listCatalogItemsEndpoint = createAdminEndpoint(
	"/admin/pinterest-shop/items",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["active", "inactive", "disapproved"]).optional(),
			availability: z.enum(["in-stock", "out-of-stock", "preorder"]).optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.pinterestShop as PinterestShopController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;

		// Fetch all matching for accurate total count, then slice for page
		const all = await controller.listCatalogItems({
			status: ctx.query.status as CatalogItemStatus | undefined,
			availability: ctx.query.availability as Availability | undefined,
		});
		const total = all.length;
		const items = all.slice(skip, skip + limit);
		return { items, total };
	},
);
