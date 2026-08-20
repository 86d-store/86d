import { createStoreEndpoint } from "@86d-app/core/api";
import { orderCustomerAuthorizeCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "@86d-app/core/zod";
import type { GiftWrappingController } from "../../service";

export const orderWrapping = createStoreEndpoint(
	"/gift-wrapping/order/:orderId",
	{
		method: "GET",
		params: z.object({
			orderId: z.string().min(1).max(100),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const authorization = await ctx.context.capabilities.invoke(
			orderCustomerAuthorizeCapability,
			{ orderId: ctx.params.orderId, customerId: userId },
		);
		if (!authorization.ok) {
			if (
				authorization.failure.code === "order_not_found" ||
				authorization.failure.code === "not_owner"
			) {
				return { error: "Order not found", status: 404 };
			}
			return {
				code: "ORDER_AUTHORIZATION_UNAVAILABLE",
				error: "Order authorization is unavailable.",
				status: 503,
			};
		}

		const controller = ctx.context.controllers
			.giftWrapping as GiftWrappingController;
		const result = await controller.getOrderWrappingTotal(ctx.params.orderId);
		return result;
	},
);
