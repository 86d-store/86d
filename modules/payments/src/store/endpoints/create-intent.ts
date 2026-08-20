import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PaymentController } from "../../service";

export const createIntent = createStoreEndpoint(
	"/payments/intents",
	{
		method: "POST",
		body: z.object({
			amount: z.number().int().positive(),
			currency: z.string().max(3).optional(),
			email: z.string().email().max(320).optional(),
			orderId: z.string().max(200).optional(),
			checkoutSessionId: z.string().max(200).optional(),
			metadata: z
				.record(
					z
						.string()
						.max(100)
						.regex(/^[\w.-]+$/),
					z.unknown(),
				)
				.refine((obj) => Object.keys(obj).length <= 20, {
					message: "Metadata must have at most 20 keys",
				})
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.payments as PaymentController;
		// Authenticated users must use session email — never fall back to body
		const email = ctx.context.session
			? ctx.context.session.user.email
			: ctx.body.email;
		const intent = await controller.createIntent({
			amount: ctx.body.amount,
			currency: ctx.body.currency,
			email,
			orderId: ctx.body.orderId,
			checkoutSessionId: ctx.body.checkoutSessionId,
			metadata: ctx.body.metadata,
		});
		return { intent };
	},
);
