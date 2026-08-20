import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { CustomerController } from "../../service";

export const adminImportCustomers = createAdminEndpoint(
	"/admin/customers/import",
	{
		method: "POST",
		body: z.object({
			customers: z
				.array(
					z.object({
						email: z.string().min(1).max(320).transform(sanitizeText),
						firstName: z.string().max(100).transform(sanitizeText).optional(),
						lastName: z.string().max(100).transform(sanitizeText).optional(),
						phone: z.string().max(50).transform(sanitizeText).optional(),
						tags: z.array(z.string().max(50)).optional(),
					}),
				)
				.min(1)
				.max(1000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const result = await controller.importCustomers(ctx.body.customers);
		return result;
	},
);
