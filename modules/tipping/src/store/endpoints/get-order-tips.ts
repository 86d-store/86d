import { createStoreEndpoint } from "@86d-app/core/api";
import { orderCustomerAuthorizeCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "zod";
import type { TippingController } from "../../service";

export const getOrderTips = createStoreEndpoint(
	"/tipping/tips/order/:orderId",
	{
		method: "GET",
		params: z.object({ orderId: z.string().max(128) }),
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

		const controller = ctx.context.controllers.tipping as TippingController;
		const tips = await controller.listTips({
			orderId: ctx.params.orderId,
		});
		const total = await controller.getTipTotal(ctx.params.orderId);
		return { tips, total };
	},
);
