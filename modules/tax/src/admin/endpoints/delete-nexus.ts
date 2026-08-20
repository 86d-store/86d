import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TaxController } from "../../service";

export const adminDeleteNexus = createAdminEndpoint(
	"/admin/tax/nexus/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const deleted = await controller.deleteNexus(ctx.params.id);
		if (!deleted) {
			return { error: "Nexus not found", status: 404 };
		}
		return { success: true };
	},
);
