import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SavedAddressesController } from "../../service";

export const adminDeleteAddress = createAdminEndpoint(
	"/admin/saved-addresses/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
		body: z.object({
			customerId: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.savedAddresses as SavedAddressesController;
		const deleted = await controller.delete(ctx.body.customerId, ctx.params.id);

		if (!deleted) {
			return { error: "Address not found", status: 404 };
		}

		return { success: true };
	},
);
