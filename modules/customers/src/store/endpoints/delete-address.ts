import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import { resolveAuthenticatedStoreCustomer } from "./customer-context";

export const deleteAddress = createStoreEndpoint(
	"/customers/me/addresses/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const resolved = await resolveAuthenticatedStoreCustomer(ctx.context);
		if (!resolved.ok) return resolved.response;

		// Verify ownership
		const existing = await resolved.controller.getAddress(ctx.params.id);
		if (!existing || existing.customerId !== resolved.customer.id) {
			return { error: "Address not found", status: 404 };
		}

		await resolved.controller.deleteAddress(ctx.params.id);
		return { success: true };
	},
);
