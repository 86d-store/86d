import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { GiftCardController } from "../../service";

export const updateGiftCard = createAdminEndpoint(
	"/admin/gift-cards/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			status: z.enum(["active", "disabled", "expired", "depleted"]).optional(),
			expiresAt: z.string().optional(),
			recipientEmail: z.string().email().max(500).optional(),
			note: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.giftCards as GiftCardController;
		const card = await controller.update(ctx.params.id, {
			...(ctx.body.status !== undefined ? { status: ctx.body.status } : {}),
			...(ctx.body.expiresAt !== undefined
				? { expiresAt: ctx.body.expiresAt }
				: {}),
			...(ctx.body.recipientEmail !== undefined
				? { recipientEmail: ctx.body.recipientEmail }
				: {}),
			...(ctx.body.note !== undefined ? { note: ctx.body.note } : {}),
		});
		if (!card) {
			return { error: "Gift card not found", status: 404 };
		}
		return { card };
	},
);
