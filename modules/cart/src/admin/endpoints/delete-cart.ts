import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CartItem } from "../../service";

export const deleteCart = createAdminEndpoint(
	"/admin/carts/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const { params } = ctx;
		const context = ctx.context;

		// Delete all cart items first
		const items = (await context.data.findMany("cartItem", {
			where: { cartId: params.id },
		})) as CartItem[];

		for (const item of items) {
			await context.data.delete("cartItem", item.id);
		}

		await context.data.delete("cart", params.id);

		return {
			success: true,
			message: `Cart ${params.id} deleted successfully`,
		};
	},
);
