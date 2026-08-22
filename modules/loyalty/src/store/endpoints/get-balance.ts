import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { LoyaltyController } from "../../service";

export const getBalance = createStoreEndpoint(
	"/loyalty/balance",
	{
		method: "GET",
		query: z.object({}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const account = await controller.getOrCreateAccount(session.user.id);
		return {
			balance: account.balance,
			tier: account.tier,
			lifetimeEarned: account.lifetimeEarned,
			lifetimeRedeemed: account.lifetimeRedeemed,
			status: account.status,
		};
	},
);
