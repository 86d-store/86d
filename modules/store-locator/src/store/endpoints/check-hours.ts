import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { StoreLocatorController } from "../../service";

export const checkHours = createStoreEndpoint(
	"/locations/:id/hours",
	{
		method: "GET",
		params: z.object({
			id: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storeLocator as StoreLocatorController;

		try {
			const result = await controller.isOpen(ctx.params.id);
			return result;
		} catch {
			return { error: "Location not found", status: 404 };
		}
	},
);
