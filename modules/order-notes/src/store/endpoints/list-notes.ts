import { createStoreEndpoint } from "@86d-app/core/api";
import { orderCustomerAuthorizeCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "@86d-app/core/zod";
import type { OrderNotesController } from "../../service";

export const listNotes = createStoreEndpoint(
	"/orders/:orderId/notes",
	{
		method: "GET",
		params: z.object({ orderId: z.string().max(200) }),
		query: z.object({
			take: z.coerce.number().min(1).max(100).optional(),
			skip: z.coerce.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}

		const authorization = await ctx.context.capabilities.invoke(
			orderCustomerAuthorizeCapability,
			{ orderId: ctx.params.orderId, customerId },
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
			.orderNotes as OrderNotesController;

		const notes = await controller.listByOrder(ctx.params.orderId, {
			includeInternal: false,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});

		return { notes };
	},
);
