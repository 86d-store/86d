import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";

export const checkWishlist = createStoreEndpoint(
	"/wishlist/check/:productId",
	{
		method: "GET",
		params: z.object({ productId: z.string().max(128) }),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { inWishlist: false, itemId: null };
		}
		const items = (await ctx.context.data.findMany("wishlistItem", {
			where: { customerId, productId: ctx.params.productId },
			take: 1,
		})) as Array<{ id: string }>;
		const match = items[0] ?? null;
		return { inWishlist: !!match, itemId: match?.id ?? null };
	},
);
