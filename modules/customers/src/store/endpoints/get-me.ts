import { createStoreEndpoint } from "@86d-app/core/api";
import { resolveAuthenticatedStoreCustomer } from "./customer-context";

export const getMe = createStoreEndpoint(
	"/customers/me",
	{ method: "GET" },
	async (ctx) => {
		const resolved = await resolveAuthenticatedStoreCustomer(ctx.context);
		if (!resolved.ok) return resolved.response;
		return { customer: resolved.customer };
	},
);
