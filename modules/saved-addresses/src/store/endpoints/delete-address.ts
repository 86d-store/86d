import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SavedAddressesController } from "../../service";

export const deleteAddress = createStoreEndpoint(
	"/addresses/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.savedAddresses as SavedAddressesController;
		const deleted = await controller.delete(customerId, ctx.params.id);

		if (!deleted) {
			return { error: "Address not found", status: 404 };
		}

		if (ctx.context.events) {
			await ctx.context.events.emit("address.deleted", {
				customerId,
				addressId: ctx.params.id,
			});
		}

		return { success: true };
	},
);
