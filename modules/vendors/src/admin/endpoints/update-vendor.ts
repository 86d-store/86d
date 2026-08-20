import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { VendorController } from "../../service";

export const updateVendor = createAdminEndpoint(
	"/admin/vendors/:id/update",
	{
		method: "PATCH",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			slug: z.string().min(1).max(200).optional(),
			email: z.string().email().max(320).optional(),
			phone: z.string().max(50).transform(sanitizeText).nullable().optional(),
			description: z
				.string()
				.max(5000)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			logo: z.string().max(1000).nullable().optional(),
			banner: z.string().max(1000).nullable().optional(),
			website: z.string().max(500).nullable().optional(),
			commissionRate: z.number().min(0).max(100).optional(),
			addressLine1: z
				.string()
				.max(500)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			addressLine2: z
				.string()
				.max(500)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			city: z.string().max(200).transform(sanitizeText).nullable().optional(),
			state: z.string().max(200).transform(sanitizeText).nullable().optional(),
			postalCode: z
				.string()
				.max(20)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			country: z
				.string()
				.max(100)
				.transform(sanitizeText)
				.nullable()
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.vendors as VendorController;

		const params: Parameters<typeof controller.updateVendor>[1] = {};
		if (ctx.body.name != null) params.name = ctx.body.name;
		if (ctx.body.slug != null) params.slug = ctx.body.slug;
		if (ctx.body.email != null) params.email = ctx.body.email;
		if (ctx.body.phone !== undefined) params.phone = ctx.body.phone;
		if (ctx.body.description !== undefined)
			params.description = ctx.body.description;
		if (ctx.body.logo !== undefined) params.logo = ctx.body.logo;
		if (ctx.body.banner !== undefined) params.banner = ctx.body.banner;
		if (ctx.body.website !== undefined) params.website = ctx.body.website;
		if (ctx.body.commissionRate != null)
			params.commissionRate = ctx.body.commissionRate;
		if (ctx.body.addressLine1 !== undefined)
			params.addressLine1 = ctx.body.addressLine1;
		if (ctx.body.addressLine2 !== undefined)
			params.addressLine2 = ctx.body.addressLine2;
		if (ctx.body.city !== undefined) params.city = ctx.body.city;
		if (ctx.body.state !== undefined) params.state = ctx.body.state;
		if (ctx.body.postalCode !== undefined)
			params.postalCode = ctx.body.postalCode;
		if (ctx.body.country !== undefined) params.country = ctx.body.country;

		const vendor = await controller.updateVendor(ctx.params.id, params);
		if (!vendor) {
			return { error: "Vendor not found", status: 404 };
		}

		return { vendor };
	},
);
