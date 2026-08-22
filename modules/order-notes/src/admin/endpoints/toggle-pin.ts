import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { OrderNotesController } from "../../service";

export const togglePin = createAdminEndpoint(
	"/admin/order-notes/:id/toggle-pin",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.orderNotes as OrderNotesController;
		const note = await controller.togglePin(ctx.params.id);

		if (!note) {
			return { error: "Note not found", status: 404 };
		}

		if (ctx.context.events) {
			await ctx.context.events.emit("orderNote.pinned", {
				noteId: note.id,
				isPinned: note.isPinned,
			});
		}

		return { note };
	},
);
