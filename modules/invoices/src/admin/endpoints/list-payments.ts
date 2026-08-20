import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const adminListPayments = createAdminEndpoint(
	"/admin/invoices/:id/payments",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const invoice = await controller.getById(ctx.params.id);
		if (!invoice) {
			return { error: "Invoice not found", status: 404 };
		}
		const payments = await controller.listPayments(ctx.params.id);
		return { payments };
	},
);
