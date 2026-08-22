import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FlashSaleController } from "../../service";

export const deleteFlashSale = createAdminEndpoint(
	"/admin/flash-sales/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		const deleted = await controller.deleteFlashSale(ctx.params.id);
		if (!deleted) {
			return { error: "Flash sale not found", status: 404 };
		}

		return { deleted: true };
	},
);
