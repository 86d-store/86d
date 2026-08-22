import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { CustomerController } from "../../service";

export const adminCreateAddress = createAdminEndpoint(
	"/admin/customers/:customerId/addresses/create",
	{
		method: "POST",
		params: z.object({ customerId: z.string() }),
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
		const controller = ctx.context.controllers.customer as CustomerController;
		const customer = await controller.getById(ctx.params.customerId);
		if (!customer) {
			return { error: "Customer not found", status: 404 };
		}
		const address = await controller.createAddress({
			customerId: ctx.params.customerId,
			...ctx.body,
		});
		return { address };
	},
);
