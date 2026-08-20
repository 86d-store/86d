import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { OrderNotesController } from "../../service";

export const adminDeleteNote = createAdminEndpoint(
	"/admin/order-notes/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const adminId = ctx.context.session?.user.id ?? "system";
		const controller = ctx.context.controllers
			.orderNotes as OrderNotesController;

		const deleted = await controller.deleteNote(ctx.params.id, adminId, true);

		if (!deleted) {
			return { error: "Note not found", status: 404 };
		}

		return { success: true };
	},
);
