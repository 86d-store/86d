import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { WishlistController } from "../../service";

export const listAllWishlists = createAdminEndpoint(
	"/admin/wishlist",
	{
		method: "GET",
		query: z.object({
			customerId: z.string().optional(),
			productId: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wishlist as WishlistController;
		const result = await controller.listAll({
			customerId: ctx.query.customerId,
			productId: ctx.query.productId,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});
		return { items: result.items, total: result.total };
	},
);
