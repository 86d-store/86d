import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import { resolveAuthenticatedStoreCustomer } from "./customer-context";

export const updateMe = createStoreEndpoint(
	"/customers/me/update",
	{
		method: "PUT",
		body: z.object({
			firstName: z.string().min(1).max(200).transform(sanitizeText).optional(),
			lastName: z.string().min(1).max(200).transform(sanitizeText).optional(),
			phone: z
				.string()
				.max(50)
				.nullable()
				.optional()
				.transform((s) =>
					s === undefined ? undefined : s === null ? null : sanitizeText(s),
				),
			dateOfBirth: z
				.string()
				.datetime()
				.transform((s) => new Date(s))
				.nullable()
				.optional(),
		}),
	},
	async (ctx) => {
		const resolved = await resolveAuthenticatedStoreCustomer(ctx.context);
		if (!resolved.ok) return resolved.response;

		const customer = await resolved.controller.update(
			resolved.customer.id,
			ctx.body,
		);
		if (!customer) {
			return { error: "Customer not found", status: 404 };
		}

		return { customer };
	},
);
