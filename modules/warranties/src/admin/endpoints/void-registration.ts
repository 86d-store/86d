import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { WarrantyController } from "../../service";

export const voidRegistration = createAdminEndpoint(
	"/admin/warranties/registrations/:id/void",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			reason: z.string().min(1).max(1000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.warranties as WarrantyController;
		const registration = await controller.voidRegistration(
			ctx.params.id,
			ctx.body.reason,
		);
		if (!registration) {
			return { error: "Registration not found", status: 404 };
		}
		return { registration };
	},
);
