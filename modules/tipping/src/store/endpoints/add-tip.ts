import { createStoreEndpoint } from "@86d-app/core/api";
import { orderCustomerAuthorizeCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "zod";
import type { TippingController } from "../../service";

export const addTip = createStoreEndpoint(
	"/tipping/tips",
	{
		method: "POST",
		body: z.object({
			orderId: z.string().min(1).max(200),
			amount: z.number().positive().max(100000),
			percentage: z.number().min(0).max(100).optional(),
			type: z.enum(["preset", "custom"]),
			recipientType: z.enum(["driver", "server", "staff", "store"]).optional(),
			recipientId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const authorization = await ctx.context.capabilities.invoke(
			orderCustomerAuthorizeCapability,
			{ orderId: ctx.body.orderId, customerId: userId },
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
		const tip = await controller.addTip({
			orderId: ctx.body.orderId,
			amount: ctx.body.amount,
			percentage: ctx.body.percentage,
			type: ctx.body.type,
			recipientType: ctx.body.recipientType,
			recipientId: ctx.body.recipientId,
			customerId: userId,
		});
		return { tip };
	},
);
