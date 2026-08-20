import { createStoreEndpoint } from "@86d-app/core/api";
import { orderCustomerAuthorizeCapability } from "@86d-app/core/commerce-capabilities";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { OrderNotesController } from "../../service";

export const addNote = createStoreEndpoint(
	"/orders/:orderId/notes/add",
	{
		method: "POST",
		params: z.object({ orderId: z.string().max(200) }),
		body: z.object({
			content: z.string().min(1).max(5000).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}

		const authorization = await ctx.context.capabilities.invoke(
			orderCustomerAuthorizeCapability,
			{ orderId: ctx.params.orderId, customerId },
		);
		if (!authorization.ok) {
			if (
				authorization.failure.code === "order_not_found" ||
				authorization.failure.code === "not_owner"
			) {
				return { error: "Order not found", status: 404 };
			}
			return {
				code: "ORDER_AUTHORIZATION_UNAVAILABLE",
				error: "Order authorization is unavailable.",
				status: 503,
			};
		}

		const customerName =
			ctx.context.session?.user.name ?? ctx.context.session?.user.email ?? "";

		const controller = ctx.context.controllers
			.orderNotes as OrderNotesController;

		const note = await controller.addNote({
			orderId: ctx.params.orderId,
			authorId: customerId,
			authorName: customerName,
			authorType: "customer",
			content: ctx.body.content,
			isInternal: false,
		});

		if (ctx.context.events) {
			await ctx.context.events.emit("orderNote.created", {
				orderId: ctx.params.orderId,
				noteId: note.id,
				authorType: "customer",
			});
		}

		return { note };
	},
);
