import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { GiftWrappingController } from "../../service";

export const selectWrapping = createStoreEndpoint(
	"/gift-wrapping/select",
	{
		method: "POST",
		body: z.object({
			orderId: z.string().min(1).max(200),
			orderItemId: z.string().min(1).max(200),
			wrapOptionId: z.string().min(1).max(200),
			recipientName: z.string().max(200).transform(sanitizeText).optional(),
			giftMessage: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftWrapping as GiftWrappingController;
		const params: import("../../service").SelectWrappingParams = {
			orderId: ctx.body.orderId,
			orderItemId: ctx.body.orderItemId,
			wrapOptionId: ctx.body.wrapOptionId,
		};
		if (ctx.body.recipientName != null)
			params.recipientName = ctx.body.recipientName;
		if (ctx.body.giftMessage != null) params.giftMessage = ctx.body.giftMessage;
		const customerId = ctx.context.session?.user.id;
		if (customerId != null) params.customerId = customerId;
		const selection = await controller.selectWrapping(params);
		return { selection };
	},
);
