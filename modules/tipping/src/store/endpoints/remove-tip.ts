import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TippingController } from "../../service";

export const removeTip = createStoreEndpoint(
	"/tipping/tips/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.tipping as TippingController;

		// Verify ownership before deletion
		const existing = await controller.getTip(ctx.params.id);
		if (!existing || existing.customerId !== customerId) {
			return { error: "Tip not found", status: 404 };
		}

		const removed = await controller.removeTip(ctx.params.id);

		if (!removed) {
			return { error: "Tip not found", status: 404 };
		}

		return { success: true };
	},
);
