import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { CustomerController } from "../../service";

export const adminUpdateAddress = createAdminEndpoint(
	"/admin/customers/:customerId/addresses/:addressId/update",
	{
		method: "POST",
		params: z.object({ customerId: z.string(), addressId: z.string() }),
		body: z.object({
			type: z.enum(["billing", "shipping"]).optional(),
			firstName: z.string().min(1).max(200).transform(sanitizeText).optional(),
			lastName: z.string().min(1).max(200).transform(sanitizeText).optional(),
			company: z
				.string()
				.max(200)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			line1: z.string().min(1).max(500).transform(sanitizeText).optional(),
			line2: z.string().max(500).transform(sanitizeText).nullable().optional(),
			city: z.string().min(1).max(200).transform(sanitizeText).optional(),
			state: z.string().min(1).max(200).transform(sanitizeText).optional(),
			postalCode: z.string().min(1).max(20).optional(),
			country: z.string().length(2).optional(),
			phone: z
				.string()
				.max(50)
				.nullable()
				.optional()
				.transform((s) => (s == null ? undefined : sanitizeText(s))),
			isDefault: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const updated = await controller.updateAddress(
			ctx.params.addressId,
			ctx.body,
		);
		if (!updated) {
			return { error: "Address not found", status: 404 };
		}
		return { address: updated };
	},
);
