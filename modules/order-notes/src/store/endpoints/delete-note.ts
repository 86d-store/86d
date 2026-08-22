import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { OrderNotesController } from "../../service";

export const deleteNote = createStoreEndpoint(
	"/orders/notes/:noteId/delete",
	{
		method: "POST",
		params: z.object({ noteId: z.string().max(200) }),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.orderNotes as OrderNotesController;
		const deleted = await controller.deleteNote(
			ctx.params.noteId,
			customerId,
			false,
		);

		if (!deleted) {
			return { error: "Note not found", status: 404 };
		}

		if (ctx.context.events) {
			await ctx.context.events.emit("orderNote.deleted", {
				noteId: ctx.params.noteId,
			});
		}

		return { success: true };
	},
);
