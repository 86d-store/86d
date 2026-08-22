import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const subscribe = createStoreEndpoint(
	"/memberships/subscribe",
	{
		method: "POST",
		body: z.object({
			planId: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.memberships as MembershipController;

		try {
			const membership = await controller.subscribe({
				customerId: session.user.id,
				planId: ctx.body.planId,
			});
			void ctx.context.events?.emit("membership.subscribed", {
				membershipId: membership.id,
				customerId: membership.customerId,
				planId: membership.planId,
			});
			return { membership };
		} catch {
			return { error: "Subscription failed", status: 400 };
		}
	},
);
