import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { LoyaltyController } from "../../service";

export const redeem = createStoreEndpoint(
	"/loyalty/redeem",
	{
		method: "POST",
		body: z.object({
			points: z.number().int().min(1),
			description: z.string().max(500).transform(sanitizeText),
			orderId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const transaction = await controller.redeemPoints({
			customerId: session.user.id,
			points: ctx.body.points,
			description: ctx.body.description,
			orderId: ctx.body.orderId,
		});
		void ctx.context.events?.emit("loyalty.pointsRedeemed", {
			customerId: session.user.id,
			points: ctx.body.points,
			orderId: ctx.body.orderId,
		});
		return { transaction };
	},
);
