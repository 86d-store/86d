import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const adminApplyCreditNote = createAdminEndpoint(
	"/admin/credit-notes/:id/apply",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const creditNote = await controller.applyCreditNote(ctx.params.id);
		if (!creditNote) {
			return {
				error: "Credit note not found or not in issued status",
				status: 422,
			};
		}

		if (ctx.context.events) {
			await ctx.context.events.emit("credit_note.applied", {
				creditNoteId: creditNote.id,
				creditNoteNumber: creditNote.creditNoteNumber,
				invoiceId: creditNote.invoiceId,
				amount: creditNote.amount,
			});
		}

		return { creditNote };
	},
);
