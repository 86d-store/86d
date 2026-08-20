import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { KioskController } from "../../service";

export const completeSessionEndpoint = createStoreEndpoint(
	"/kiosk/sessions/:id/complete",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			paymentMethod: z.string().max(50).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		const session = await controller.completeSession(
			ctx.params.id,
			ctx.body.paymentMethod,
		);
		return { session };
	},
);
