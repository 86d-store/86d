import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { GiftCardController } from "../../service";

export const createGiftCard = createAdminEndpoint(
	"/admin/gift-cards/create",
	{
		method: "POST",
		body: z.object({
			initialBalance: z.number().positive().max(10000),
			currency: z.string().max(3).optional(),
			expiresAt: z.string().optional(),
			recipientEmail: z.string().email().max(500).optional(),
			customerId: z.string().optional(),
			purchaseOrderId: z.string().optional(),
			note: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const card = await controller.create({
			initialBalance: ctx.body.initialBalance,
			currency: ctx.body.currency,
			expiresAt: ctx.body.expiresAt,
			recipientEmail: ctx.body.recipientEmail,
			customerId: ctx.body.customerId,
			purchaseOrderId: ctx.body.purchaseOrderId,
			note: ctx.body.note,
		});
		return { card };
	},
);
