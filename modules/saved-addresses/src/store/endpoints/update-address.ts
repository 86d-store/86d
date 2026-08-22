import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { SavedAddressesController } from "../../service";

export const updateAddress = createStoreEndpoint(
	"/addresses/:id/update",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
		body: z.object({
			label: z.string().max(100).transform(sanitizeText).optional(),
			firstName: z.string().max(100).transform(sanitizeText).optional(),
			lastName: z.string().max(100).transform(sanitizeText).optional(),
			company: z.string().max(200).transform(sanitizeText).optional(),
			line1: z.string().max(500).transform(sanitizeText).optional(),
			line2: z.string().max(500).transform(sanitizeText).optional(),
			city: z.string().max(200).transform(sanitizeText).optional(),
			state: z.string().max(200).transform(sanitizeText).optional(),
			postalCode: z.string().max(20).transform(sanitizeText).optional(),
			country: z.string().max(2).transform(sanitizeText).optional(),
			phone: z.string().max(30).transform(sanitizeText).optional(),
			isDefault: z.boolean().optional(),
			isDefaultBilling: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.savedAddresses as SavedAddressesController;

		const input: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(ctx.body)) {
			if (value !== undefined) {
				input[key] = value;
			}
		}

		const address = await controller.update(customerId, ctx.params.id, input);

		if (!address) {
			return { error: "Address not found", status: 404 };
		}

		if (ctx.context.events) {
			await ctx.context.events.emit("address.updated", {
				customerId,
				addressId: address.id,
			});
		}

		return { address };
	},
);
