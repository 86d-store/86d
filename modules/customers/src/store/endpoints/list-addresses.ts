import { createStoreEndpoint } from "@86d-app/core/api";
import { resolveAuthenticatedStoreCustomer } from "./customer-context";

export const listAddresses = createStoreEndpoint(
	"/customers/me/addresses",
	{ method: "GET" },
	async (ctx) => {
		const resolved = await resolveAuthenticatedStoreCustomer(ctx.context);
		if (!resolved.ok) return resolved.response;

		const addresses = await resolved.controller.listAddresses(
			resolved.customer.id,
		);
		return { addresses };
	},
);
