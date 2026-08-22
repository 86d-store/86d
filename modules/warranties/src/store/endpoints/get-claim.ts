import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WarrantyController } from "../../service";

export const getClaim = createStoreEndpoint(
	"/warranties/claims/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.warranties as WarrantyController;
		const claim = await controller.getClaim(ctx.params.id);

		if (!claim) {
			return { error: "Claim not found", status: 404 };
		}
		if (claim.customerId !== userId) {
			return { error: "Claim not found", status: 404 };
		}

		return { claim };
	},
);
