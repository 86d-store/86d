import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CollectionController } from "../../service";

export const deleteCollection = createAdminEndpoint(
	"/admin/collections/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		const deleted = await controller.deleteCollection(ctx.params.id);
		if (!deleted) {
			return { error: "Collection not found", status: 404 };
		}

		return { success: true };
	},
);
