import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { VendorController } from "../../service";

export const createVendor = createAdminEndpoint(
	"/admin/vendors/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200),
			email: z.string().email().max(320),
			phone: z.string().max(50).transform(sanitizeText).optional(),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			logo: z.string().max(1000).optional(),
			banner: z.string().max(1000).optional(),
			website: z.string().max(500).optional(),
			commissionRate: z.number().min(0).max(100).optional(),
			status: z.enum(["pending", "active", "suspended", "closed"]).optional(),
			addressLine1: z.string().max(500).transform(sanitizeText).optional(),
			addressLine2: z.string().max(500).transform(sanitizeText).optional(),
			city: z.string().max(200).transform(sanitizeText).optional(),
			state: z.string().max(200).transform(sanitizeText).optional(),
			postalCode: z.string().max(20).transform(sanitizeText).optional(),
			country: z.string().max(100).transform(sanitizeText).optional(),
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
		};
		if (ctx.body.phone != null) params.phone = ctx.body.phone;
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.logo != null) params.logo = ctx.body.logo;
		if (ctx.body.banner != null) params.banner = ctx.body.banner;
		if (ctx.body.website != null) params.website = ctx.body.website;
		if (ctx.body.commissionRate != null)
			params.commissionRate = ctx.body.commissionRate;
		if (ctx.body.status != null) params.status = ctx.body.status;
		if (ctx.body.addressLine1 != null)
			params.addressLine1 = ctx.body.addressLine1;
		if (ctx.body.addressLine2 != null)
			params.addressLine2 = ctx.body.addressLine2;
		if (ctx.body.city != null) params.city = ctx.body.city;
		if (ctx.body.state != null) params.state = ctx.body.state;
		if (ctx.body.postalCode != null) params.postalCode = ctx.body.postalCode;
		if (ctx.body.country != null) params.country = ctx.body.country;

		const vendor = await controller.createVendor(params);

		return { vendor };
	},
);
