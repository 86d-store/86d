import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { OrderController } from "../../service";

export const adminAddNote = createAdminEndpoint(
	"/admin/orders/:id/notes/add",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			content: z.string().min(1).max(5000),
			authorName: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.order as OrderController;

		// Verify order exists
		const order = await controller.getById(ctx.params.id);
		if (!order) {
			return { error: "Order not found", status: 404 };
		}

		const note = await controller.addNote({
			orderId: ctx.params.id,
			content: ctx.body.content,
			type: "note",
			authorName: ctx.body.authorName,
		});

		return { note };
	},
);
