import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { KioskController } from "../../service";

export const updateItemEndpoint = createStoreEndpoint(
	"/kiosk/sessions/:id/items/:itemId",
	{
		method: "PUT",
		params: z.object({ id: z.string().max(128), itemId: z.string().max(128) }),
		body: z.object({
			quantity: z.number().int().min(0),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		const session = await controller.updateItemQuantity(
			ctx.params.id,
			ctx.params.itemId,
			ctx.body.quantity,
		);

		if (!session) {
			return { error: "Session or item not found", status: 404 };
		}

		return { session };
	},
);
