import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AutomationsController } from "../../service";

export const executeAutomation = createAdminEndpoint(
	"/admin/automations/:id/execute",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			payload: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.automations as AutomationsController;
		try {
			const execution = await controller.execute(
				ctx.params.id,
				ctx.body.payload ?? {},
			);
			return { execution };
		} catch {
			return { error: "Automation not found", status: 404 };
		}
	},
);
