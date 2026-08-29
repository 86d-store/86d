import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GiftCardController } from "../../service";
import { GiftCardDataUnavailableError } from "../../service-impl";

export const listMyGiftCards = createStoreEndpoint(
	"/gift-cards/my-cards",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.giftCards as GiftCardController;
		try {
			const cards = await controller.listByCustomer(session.user.id, {
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			});

			return {
				cards: cards.map((card) => ({
					id: card.id,
					code: card.code,
					currentBalance: card.currentBalance,
					initialBalance: card.initialBalance,
					currency: card.currency,
					status: card.status,
					expiresAt: card.expiresAt,
					recipientEmail: card.recipientEmail,
					recipientName: card.recipientName,
					senderName: card.senderName,
					message: card.message,
					createdAt: card.createdAt,
				})),
				total: cards.length,
			};
		} catch (error) {
			if (error instanceof GiftCardDataUnavailableError) {
				return { error: "Gift cards are unavailable", status: 503 };
			}
			throw error;
		}
	},
);
