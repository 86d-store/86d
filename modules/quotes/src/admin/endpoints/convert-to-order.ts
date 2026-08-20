import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { QuoteController } from "../../service";

export const convertToOrderEndpoint = createAdminEndpoint(
	"/admin/quotes/:id/convert",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			orderId: z.string().max(128),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const quote = await controller.convertToOrder(
			ctx.params.id,
			ctx.body.orderId,
		);
		if (!quote) return { error: "Cannot convert this quote to an order" };
		void ctx.context.events?.emit("quote.converted", {
			quoteId: quote.id,
			customerId: quote.customerId,
			orderId: ctx.body.orderId,
			total: quote.total,
		});
		return { quote };
	},
);
