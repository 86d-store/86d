import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { WishlistController } from "../../service";

export const listWishlist = createStoreEndpoint(
	"/wishlist",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}
		const controller = ctx.context.controllers.wishlist as WishlistController;
		const [items, count] = await Promise.all([
			controller.listByCustomer(customerId, {
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countByCustomer(customerId),
		]);
		return { items, total: count };
	},
);
