import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { GiftCardController } from "../../service";

export const purchaseGiftCard = createStoreEndpoint(
	"/gift-cards/purchase",
	{
		method: "POST",
		body: z.object({
			amount: z.number().positive().max(10000),
			currency: z.string().max(3).optional(),
			recipientEmail: z.string().email().max(500).optional(),
			recipientName: z.string().max(200).transform(sanitizeText).optional(),
			senderName: z.string().max(200).transform(sanitizeText).optional(),
			message: z.string().max(500).transform(sanitizeText).optional(),
			deliveryMethod: z.enum(["email", "digital"]).optional(),
			scheduledDeliveryAt: z.string().max(50).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const card = await controller.purchase({
			amount: ctx.body.amount,
			currency: ctx.body.currency,
			customerId: session.user.id,
			customerEmail: session.user.email,
			recipientEmail: ctx.body.recipientEmail,
			recipientName: ctx.body.recipientName,
			senderName: ctx.body.senderName,
			message: ctx.body.message,
			deliveryMethod: ctx.body.deliveryMethod,
			scheduledDeliveryAt: ctx.body.scheduledDeliveryAt,
		});

		return {
			id: card.id,
			code: card.code,
			balance: card.currentBalance,
			currency: card.currency,
			recipientEmail: card.recipientEmail,
		};
	},
);
