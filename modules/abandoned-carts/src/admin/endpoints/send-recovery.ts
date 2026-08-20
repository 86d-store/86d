import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AbandonedCartController } from "../../service";

export const sendRecovery = createAdminEndpoint(
	"/admin/abandoned-carts/:id/recover",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			channel: z.enum(["email", "sms", "push"]),
			recipient: z.string().min(1).max(320),
			subject: z.string().min(1).max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.abandonedCarts as AbandonedCartController;
		const cart = await controller.get(ctx.params.id);
		if (!cart) return { error: "Abandoned cart not found", status: 404 };
		if (cart.status !== "active") {
			return { error: "Cart is no longer active", status: 400 };
		}

		const opts = controller.getOptions();
		if (cart.attemptCount >= opts.maxRecoveryAttempts) {
			return {
				error: `Maximum recovery attempts (${opts.maxRecoveryAttempts}) reached`,
				status: 400,
			};
		}

		const attempt = await controller.recordAttempt({
			abandonedCartId: ctx.params.id,
			channel: ctx.body.channel,
			recipient: ctx.body.recipient,
			subject: ctx.body.subject,
		});

		await ctx.context.events?.emit("cart.recoveryAttempted", {
			cartId: ctx.params.id,
			channel: ctx.body.channel,
			recipient: ctx.body.recipient,
			attemptId: attempt.id,
		});

		return { attempt };
	},
);
