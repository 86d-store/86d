import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const adminVoidCreditNote = createAdminEndpoint(
	"/admin/credit-notes/:id/void",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const creditNote = await controller.voidCreditNote(ctx.params.id);
		if (!creditNote) {
			return {
				error: "Credit note not found or cannot be voided",
				status: 422,
			};
		}
		return { creditNote };
	},
);
