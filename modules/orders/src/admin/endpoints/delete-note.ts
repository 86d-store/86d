import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { OrderController } from "../../service";

export const adminDeleteNote = createAdminEndpoint(
	"/admin/orders/notes/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.order as OrderController;
		await controller.deleteNote(ctx.params.id);
		return { success: true };
	},
);
