import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { GiftCardController } from "../../service";

export const sendGiftCard = createStoreEndpoint(
	"/gift-cards/send",
	{
		method: "POST",
		body: z.object({
			giftCardId: z.string().max(200),
			recipientEmail: z.string().email().max(500),
			recipientName: z.string().max(200).transform(sanitizeText).optional(),
			senderName: z.string().max(200).transform(sanitizeText).optional(),
			message: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const result = await controller.sendGiftCard({
			giftCardId: ctx.body.giftCardId,
			customerId: session.user.id,
			recipientEmail: ctx.body.recipientEmail,
			recipientName: ctx.body.recipientName,
			senderName: ctx.body.senderName,
			message: ctx.body.message,
		});

		if (!result) {
			return {
				error: "Gift card not found, not owned by you, or already sent",
				status: 400,
			};
		}

		return {
			id: result.id,
			recipientEmail: result.recipientEmail,
			delivered: result.delivered,
		};
	},
);
