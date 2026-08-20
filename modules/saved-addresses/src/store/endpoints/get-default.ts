import { createStoreEndpoint } from "@86d-app/core/api";
import type { SavedAddressesController } from "../../service";

export const getDefaultAddress = createStoreEndpoint(
	"/addresses/default",
	{ method: "GET" },
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.savedAddresses as SavedAddressesController;
		const address = await controller.getDefault(customerId);

		return { address };
	},
);

export const getDefaultBillingAddress = createStoreEndpoint(
	"/addresses/default-billing",
	{ method: "GET" },
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.savedAddresses as SavedAddressesController;
		const address = await controller.getDefaultBilling(customerId);

		return { address };
	},
);
