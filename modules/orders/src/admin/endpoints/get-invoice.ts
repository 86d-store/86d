import { createAdminEndpoint } from "@86d-app/core/api";
import { storePresentationResolveCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "@86d-app/core/zod";
import { createOrderController } from "../../service-impl";

export const adminGetInvoice = createAdminEndpoint(
	"/admin/orders/:id/invoice",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = createOrderController(ctx.context.data);
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
		const invoice = await controller.getInvoiceData(
			ctx.params.id,
			presentation.decision.storeName,
		);
		if (!invoice) {
			return { error: "Order not found", status: 404 };
		}
		return { invoice };
	},
);
