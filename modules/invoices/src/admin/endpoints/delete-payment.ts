import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const adminDeletePayment = createAdminEndpoint(
	"/admin/invoices/payments/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		await controller.deletePayment(ctx.params.id);
		return { success: true };
	},
);
