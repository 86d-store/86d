import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { OrderController } from "../../service";

export const adminListNotes = createAdminEndpoint(
	"/admin/orders/:id/notes",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.order as OrderController;
		const notes = await controller.listNotes(ctx.params.id);
		return { notes };
	},
);
