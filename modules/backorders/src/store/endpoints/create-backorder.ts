import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { BackordersController } from "../../service";

export const createBackorder = createStoreEndpoint(
	"/backorders/create",
	{
		method: "POST",
		body: z.object({
			productId: z.string().max(200),
			productName: z.string().max(500).transform(sanitizeText),
			variantId: z.string().max(200).optional(),
			variantLabel: z.string().max(200).transform(sanitizeText).optional(),
			orderId: z.string().max(200).optional(),
			quantity: z.number().int().min(1).max(9999),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const backorder = await controller.createBackorder({
			productId: ctx.body.productId,
			productName: ctx.body.productName,
			variantId: ctx.body.variantId,
			variantLabel: ctx.body.variantLabel,
			customerId: session.user.id,
			customerEmail: session.user.email,
			orderId: ctx.body.orderId,
			quantity: ctx.body.quantity,
		});
		if (!backorder) {
			return { error: "Backorder not eligible", backorder: null };
		}
		return { backorder };
	},
);
