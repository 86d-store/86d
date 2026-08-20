import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { StoreCreditController } from "../../service";

export const unfreezeAccount = createAdminEndpoint(
	"/admin/store-credits/accounts/:customerId/unfreeze",
	{
		method: "POST",
		params: z.object({
			customerId: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"store-credits"
		] as StoreCreditController;
		const account = await controller.unfreezeAccount(ctx.params.customerId);
		void ctx.context.events?.emit("store-credits.account.unfrozen", {
			customerId: ctx.params.customerId,
		});
		return { account };
	},
);
