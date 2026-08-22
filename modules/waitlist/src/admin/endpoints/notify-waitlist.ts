import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WaitlistController } from "../../service";

export const notifyWaitlist = createAdminEndpoint(
	"/admin/waitlist/:productId/notify",
	{
		method: "POST",
		params: z.object({ productId: z.string().max(200) }),
		body: z.object({
			productId: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.waitlist as WaitlistController;
		const notifiedCount = await controller.markNotified(ctx.params.productId);
		void ctx.context.events?.emit("waitlist.notified", {
			productId: ctx.params.productId,
			notifiedCount,
		});
		return { notifiedCount };
	},
);
