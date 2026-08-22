import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type {
	CreateBlackoutParams,
	StorePickupController,
} from "../../service";

export const createBlackout = createAdminEndpoint(
	"/admin/store-pickup/blackouts/create",
	{
		method: "POST",
		body: z.object({
			locationId: z.string().min(1),
			date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
			reason: z.string().max(500).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const params: CreateBlackoutParams = {
			locationId: ctx.body.locationId,
			date: ctx.body.date,
		};
		if (ctx.body.reason != null) params.reason = ctx.body.reason;
		try {
			const blackout = await controller.createBlackout(params);
			return { blackout };
		} catch {
			return { error: "Failed to create blackout date", status: 400 };
		}
	},
);
