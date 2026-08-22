import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { VendorController } from "../../service";

export const apply = createStoreEndpoint(
	"/vendors/apply",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200).transform(sanitizeText),
			email: z.string().email().max(320),
			phone: z.string().max(50).transform(sanitizeText).optional(),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			website: z.string().url().max(2000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const existing = await controller.getVendorBySlug(ctx.body.slug);
		if (existing) {
			return {
				error: "A vendor with this slug already exists",
				status: 400,
			};
		}

		const params: Parameters<typeof controller.createVendor>[0] = {
			name: ctx.body.name,
			slug: ctx.body.slug,
			email: ctx.body.email,
			status: "pending",
		};
		if (ctx.body.phone != null) params.phone = ctx.body.phone;
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.website != null) params.website = ctx.body.website;

		const vendor = await controller.createVendor(params);

		return { vendor };
	},
);
