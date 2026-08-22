import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DeliverySlotsController } from "../../service";

export const deleteBlackout = createAdminEndpoint(
	"/admin/delivery-slots/blackouts/:id/delete",
	{ method: "POST", params: z.object({ id: z.string().max(200) }) },
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const deleted = await controller.deleteBlackout(ctx.params.id);
		return { deleted };
	},
);
