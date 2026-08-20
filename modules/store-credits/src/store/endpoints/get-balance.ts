import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { StoreCreditController } from "../../service";

export const getBalance = createStoreEndpoint(
	"/store-credits/balance",
	{
		method: "GET",
		query: z.object({}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers[
			"store-credits"
		] as StoreCreditController;
		const account = await controller.getOrCreateAccount(
			session.user.id,
			session.user.email,
		);
		return {
			balance: account.balance,
			currency: account.currency,
			status: account.status,
		};
	},
);
