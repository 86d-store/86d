import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SavedAddressesController } from "../../service";

export const setDefaultAddress = createStoreEndpoint(
	"/addresses/:id/set-default",
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
		const success = await controller.setDefault(customerId, ctx.params.id);

		if (!success) {
			return { error: "Address not found", status: 404 };
		}

		if (ctx.context.events) {
			await ctx.context.events.emit("address.defaultChanged", {
				customerId,
				addressId: ctx.params.id,
				type: "shipping",
			});
		}

		return { success: true };
	},
);

export const setDefaultBillingAddress = createStoreEndpoint(
	"/addresses/:id/set-default-billing",
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
		const success = await controller.setDefaultBilling(
			customerId,
			ctx.params.id,
		);

		if (!success) {
			return { error: "Address not found", status: 404 };
		}

		if (ctx.context.events) {
			await ctx.context.events.emit("address.defaultChanged", {
				customerId,
				addressId: ctx.params.id,
				type: "billing",
			});
		}

		return { success: true };
	},
);
