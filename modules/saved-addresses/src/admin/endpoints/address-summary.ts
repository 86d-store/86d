import { createAdminEndpoint } from "@86d-app/core/api";
import type { SavedAddressesController } from "../../service";

export const addressSummary = createAdminEndpoint(
	"/admin/saved-addresses/summary",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers
			.savedAddresses as SavedAddressesController;
		return controller.getSummary();
	},
);
