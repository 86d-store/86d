import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { TaxController, TaxNexusType } from "../../service";

export const adminCreateNexus = createAdminEndpoint(
	"/admin/tax/nexus/create",
	{
		method: "POST",
		body: z.object({
			country: z.string().length(2),
			state: z.string().max(100).transform(sanitizeText).optional(),
			type: z.enum(["physical", "economic", "voluntary"]).optional(),
			notes: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const nexus = await controller.createNexus({
			...ctx.body,
			type: ctx.body.type as TaxNexusType | undefined,
		});
		return { nexus };
	},
);
