import { createStoreEndpoint } from "@86d-app/core/api";
import { productResolveCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "zod";
import { resolveOrderCustomerContext } from "./customer-context";

export const reorder = createStoreEndpoint(
	"/orders/me/:id/reorder",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const customerContext = await resolveOrderCustomerContext(ctx.context);
		if (!customerContext.ok) return customerContext.response;

		const order = await customerContext.controller.getById(ctx.params.id);

		if (!order || order.customerId !== customerContext.customerId) {
			return { error: "Order not found", status: 404 };
		}

		const items = await customerContext.controller.getReorderItems(
			ctx.params.id,
		);
		if (!items || items.length === 0) {
			return { error: "No items to reorder", status: 422 };
		}

		const enrichedItems = await Promise.all(
			items.map(async (item) => {
				let slug: string | undefined;
				let image: string | undefined;
				const resolved = await ctx.context.capabilities.invoke(
					productResolveCapability,
					{
						productId: item.productId,
						...(item.variantId ? { variantId: item.variantId } : {}),
					},
				);
				if (resolved.ok) {
					slug = resolved.decision.product.slug;
					image =
						resolved.decision.variant?.images[0] ??
						resolved.decision.product.images[0];
				}
				return {
					...item,
					slug: slug ?? item.productId,
					image,
				};
			}),
		);

		return { items: enrichedItems };
	},
);
