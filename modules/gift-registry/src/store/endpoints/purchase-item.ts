import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { GiftRegistryController, PurchaseItemParams } from "../../service";

export const purchaseItem = createStoreEndpoint(
	"/gift-registry/purchase",
	{
		method: "POST",
		body: z.object({
			registryId: z.string().max(200),
			registryItemId: z.string().max(200),
			purchaserName: z.string().min(1).max(200).transform(sanitizeText),
			quantity: z.number().int().min(1).max(100),
			amountInCents: z.number().int().min(1),
			orderId: z.string().max(200).optional(),
			giftMessage: z.string().max(1000).transform(sanitizeText).optional(),
			isAnonymous: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const params: PurchaseItemParams = {
			registryId: ctx.body.registryId,
			registryItemId: ctx.body.registryItemId,
			purchaserName: ctx.body.purchaserName,
			quantity: ctx.body.quantity,
			amountInCents: ctx.body.amountInCents,
		};
		const userId = ctx.context.session?.user?.id;
		if (userId) params.purchaserId = userId;
		if (ctx.body.orderId) params.orderId = ctx.body.orderId;
		if (ctx.body.giftMessage) params.giftMessage = ctx.body.giftMessage;
		if (ctx.body.isAnonymous != null) params.isAnonymous = ctx.body.isAnonymous;

		const purchase = await controller.purchaseItem(params);
		return { purchase };
	},
);
