import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { LoyaltyController } from "../../service";

export const listRules = createAdminEndpoint(
	"/admin/loyalty/rules",
	{
		method: "GET",
		query: z.object({
			activeOnly: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const rules = await controller.listRules(ctx.query.activeOnly);
		return { rules };
	},
);
