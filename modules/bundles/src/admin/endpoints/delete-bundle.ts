import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BundleController } from "../../service";

export const deleteBundle = createAdminEndpoint(
	"/admin/bundles/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.bundles as BundleController;
		const deleted = await controller.delete(ctx.params.id);

		if (!deleted) {
			return { error: "Bundle not found", status: 404 };
		}

		return { success: true };
	},
);
