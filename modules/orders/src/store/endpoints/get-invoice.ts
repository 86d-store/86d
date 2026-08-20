import { createStoreEndpoint } from "@86d-app/core/api";
import { storePresentationResolveCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "@86d-app/core/zod";
import { resolveOrderCustomerContext } from "./customer-context";

export const getMyInvoice = createStoreEndpoint(
	"/orders/me/:id/invoice",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const customerContext = await resolveOrderCustomerContext(ctx.context);
		if (!customerContext.ok) return customerContext.response;

		const order = await customerContext.controller.getById(ctx.params.id);

		if (!order) {
			return { error: "Order not found", status: 404 };
		}

		if (order.customerId !== customerContext.customerId) {
			return { error: "Order not found", status: 404 };
		}

		const presentation = await ctx.context.capabilities.invoke(
			storePresentationResolveCapability,
			{},
		);
		if (!presentation.ok) {
			return {
				code: "STORE_PRESENTATION_UNAVAILABLE",
				error: "Authoritative Store presentation settings are unavailable.",
				status: 503,
			};
		}
		const invoice = await customerContext.controller.getInvoiceData(
			ctx.params.id,
			presentation.decision.storeName,
		);
		if (!invoice) {
			return { error: "Invoice not found", status: 404 };
		}

		return { invoice };
	},
);
