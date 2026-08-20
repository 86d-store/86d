import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const adminDeleteInvoice = createAdminEndpoint(
	"/admin/invoices/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const existing = await controller.getById(ctx.params.id);
		if (!existing) {
			return { error: "Invoice not found", status: 404 };
		}
		await controller.delete(ctx.params.id);
		return { success: true };
	},
);
