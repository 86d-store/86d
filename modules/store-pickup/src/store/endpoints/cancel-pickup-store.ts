import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { StorePickupController } from "../../service";

export const cancelPickupStore = createStoreEndpoint(
	"/store-pickup/:id/cancel",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1).max(100),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const existing = await controller.getPickup(ctx.params.id);
		if (!existing) {
			return { error: "Pickup not found", status: 404 };
		}

		if (existing.customerId && existing.customerId !== session.user.id) {
			return { error: "Pickup not found", status: 404 };
		}

		const pickup = await controller.cancelPickup(ctx.params.id);
		if (!pickup) {
			return { error: "Pickup not found", status: 404 };
		}

		return { pickup };
	},
);
