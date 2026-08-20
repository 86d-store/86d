import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import { resolveAuthenticatedStoreCustomer } from "./customer-context";

export const createAddress = createStoreEndpoint(
	"/customers/me/addresses/create",
	{
		method: "POST",
		body: z.object({
			type: z.enum(["billing", "shipping"]).optional(),
			firstName: z.string().min(1).max(200).transform(sanitizeText),
			lastName: z.string().min(1).max(200).transform(sanitizeText),
			company: z.string().max(200).transform(sanitizeText).optional(),
			line1: z.string().min(1).max(500).transform(sanitizeText),
			line2: z.string().max(500).transform(sanitizeText).optional(),
			city: z.string().min(1).max(200).transform(sanitizeText),
			state: z.string().min(1).max(200).transform(sanitizeText),
			postalCode: z.string().min(1).max(20),
			country: z.string().length(2),
			phone: z
				.string()
				.max(50)
				.optional()
				.transform((s) => (s === undefined ? undefined : sanitizeText(s))),
			isDefault: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const resolved = await resolveAuthenticatedStoreCustomer(ctx.context);
		if (!resolved.ok) return resolved.response;

		const address = await resolved.controller.createAddress({
			customerId: resolved.customer.id,
			...ctx.body,
		});
		return { address };
	},
);
