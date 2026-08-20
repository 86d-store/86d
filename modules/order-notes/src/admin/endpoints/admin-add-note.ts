import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { OrderNotesController } from "../../service";

export const adminAddNote = createAdminEndpoint(
	"/admin/order-notes/add",
	{
		method: "POST",
		body: z.object({
			orderId: z.string().max(200),
			content: z.string().min(1).max(5000).transform(sanitizeText),
			isInternal: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const adminId = ctx.context.session?.user.id ?? "system";
		const adminName =
			ctx.context.session?.user.name ??
			ctx.context.session?.user.email ??
			"Admin";

		const controller = ctx.context.controllers
			.orderNotes as OrderNotesController;

		const note = await controller.addNote({
			orderId: ctx.body.orderId,
			authorId: adminId,
			authorName: adminName,
			authorType: "admin",
			content: ctx.body.content,
			isInternal: ctx.body.isInternal,
		});

		if (ctx.context.events) {
			await ctx.context.events.emit("orderNote.created", {
				orderId: ctx.body.orderId,
				noteId: note.id,
				authorType: "admin",
				isInternal: note.isInternal,
			});
		}

		return { note };
	},
);
