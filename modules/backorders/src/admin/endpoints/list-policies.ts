import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BackordersController } from "../../service";

export const listPolicies = createAdminEndpoint(
	"/admin/backorders/policies",
	{
		method: "GET",
		query: z.object({
			enabled: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const policies = await controller.listPolicies({
			enabled: ctx.query.enabled,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});
		return { policies };
	},
);
