import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { CustomerController } from "../../service";

export const adminUpdateCustomer = createAdminEndpoint(
	"/admin/customers/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			firstName: z.string().min(1).max(200).transform(sanitizeText).optional(),
			lastName: z.string().min(1).max(200).transform(sanitizeText).optional(),
			phone: z.string().max(30).nullable().optional(),
			dateOfBirth: z
				.string()
				.datetime()
				.transform((s) => new Date(s))
				.nullable()
				.optional(),
			metadata: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const customer = await controller.update(ctx.params.id, ctx.body);
		if (!customer) {
			return { error: "Customer not found", status: 404 };
		}
		return { customer };
	},
);
