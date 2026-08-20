import { createStoreEndpoint } from "@86d-app/core/api";
import type { CustomerController } from "../../service";

export const getLoyaltyBalance = createStoreEndpoint(
	"/customers/me/loyalty",
	{ method: "GET" },
	async (ctx) => {
		const userId = ctx.context.session?.user.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.customer as CustomerController;
		const balance = await controller.getLoyaltyBalance(userId);
		return { balance };
	},
);
