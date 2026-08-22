import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { InvoiceController } from "../../service";

export const adminGetCreditNote = createAdminEndpoint(
	"/admin/credit-notes/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const creditNote = await controller.getCreditNote(ctx.params.id);
		if (!creditNote) {
			return { error: "Credit note not found", status: 404 };
		}
		return { creditNote };
	},
);
