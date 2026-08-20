import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { KioskController } from "../../service";

export const addItemEndpoint = createStoreEndpoint(
	"/kiosk/sessions/:id/items",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			name: z.string().max(200).transform(sanitizeText),
			price: z.number().min(0),
			quantity: z.number().int().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		const session = await controller.addItem(ctx.params.id, {
			name: ctx.body.name,
			price: ctx.body.price,
			quantity: ctx.body.quantity,
		});
		return { session };
	},
);
