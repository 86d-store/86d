import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AffiliateController } from "../../service";

export const rejectConversionEndpoint = createAdminEndpoint(
	"/admin/affiliates/conversions/:id/reject",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.affiliates as AffiliateController;
		const conversion = await controller.rejectConversion(ctx.params.id);
		if (!conversion) return { error: "Unable to reject conversion" };
		return { conversion };
	},
);
