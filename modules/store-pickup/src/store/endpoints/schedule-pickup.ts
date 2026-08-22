import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type {
	SchedulePickupParams,
	StorePickupController,
} from "../../service";

export const schedulePickup = createStoreEndpoint(
	"/store-pickup/schedule",
	{
		method: "POST",
		body: z.object({
			locationId: z.string().min(1).max(200),
			windowId: z.string().min(1).max(200),
			orderId: z.string().min(1).max(200),
			scheduledDate: z
				.string()
				.max(10)
				.regex(/^\d{4}-\d{2}-\d{2}$/),
			notes: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const params: SchedulePickupParams = {
			locationId: ctx.body.locationId,
			windowId: ctx.body.windowId,
			orderId: ctx.body.orderId,
			scheduledDate: ctx.body.scheduledDate,
			customerId: session.user.id,
		};
		if (ctx.body.notes != null) params.notes = ctx.body.notes;
		const pickup = await controller.schedulePickup(params);
		return { pickup };
	},
);
