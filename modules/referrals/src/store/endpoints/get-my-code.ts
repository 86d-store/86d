import { createStoreEndpoint } from "@86d-app/core/api";
import type { ReferralController } from "../../service";

export const getMyCodeEndpoint = createStoreEndpoint(
	"/referrals/my-code",
	{
		method: "GET",
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers.referrals as ReferralController;
		let code = await controller.getCodeForCustomer(customerId);

		// Auto-create a code for the customer if they don't have one
		if (!code) {
			code = await controller.createCode({
				customerId,
				customerEmail: ctx.context.session?.user.email,
			});
		}

		return { code };
	},
);
