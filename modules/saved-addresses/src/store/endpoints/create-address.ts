import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { SavedAddressesController } from "../../service";

export const createAddress = createStoreEndpoint(
	"/addresses/create",
	{
		method: "POST",
		body: z.object({
			label: z.string().max(100).transform(sanitizeText).optional(),
			firstName: z.string().max(100).transform(sanitizeText),
			lastName: z.string().max(100).transform(sanitizeText),
			company: z.string().max(200).transform(sanitizeText).optional(),
			line1: z.string().max(500).transform(sanitizeText),
			line2: z.string().max(500).transform(sanitizeText).optional(),
			city: z.string().max(200).transform(sanitizeText),
			state: z.string().max(200).transform(sanitizeText).optional(),
			postalCode: z.string().max(20).transform(sanitizeText),
			country: z.string().max(2).transform(sanitizeText),
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

		try {
			const address = await controller.create(customerId, ctx.body);

			if (ctx.context.events) {
				await ctx.context.events.emit("address.created", {
					customerId,
					addressId: address.id,
				});
			}

			return { address };
		} catch (err) {
			if (
				err instanceof Error &&
				err.message.includes("Address limit reached")
			) {
				return { error: err.message, status: 422 };
			}
			return { error: "Internal server error", status: 500 };
		}
	},
);
