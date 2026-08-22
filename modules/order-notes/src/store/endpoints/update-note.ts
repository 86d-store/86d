import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { OrderNotesController } from "../../service";

export const updateNote = createStoreEndpoint(
	"/orders/notes/:noteId/update",
	{
		method: "POST",
		params: z.object({ noteId: z.string().max(200) }),
		body: z.object({
			content: z.string().min(1).max(5000).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.orderNotes as OrderNotesController;
		const note = await controller.updateNote(
			ctx.params.noteId,
			customerId,
			ctx.body.content,
			false,
		);

		if (!note) {
			return { error: "Note not found", status: 404 };
		}

		if (ctx.context.events) {
			await ctx.context.events.emit("orderNote.updated", {
				noteId: note.id,
				orderId: note.orderId,
			});
		}

		return { note };
	},
);
