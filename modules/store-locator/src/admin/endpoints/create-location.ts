import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { StoreLocatorController } from "../../service";

const dayHoursSchema = z
	.object({
		open: z.string(),
		close: z.string(),
		closed: z.boolean().optional(),
	})
	.optional();

const weeklyHoursSchema = z
	.object({
		monday: dayHoursSchema,
		tuesday: dayHoursSchema,
		wednesday: dayHoursSchema,
		thursday: dayHoursSchema,
		friday: dayHoursSchema,
		saturday: dayHoursSchema,
		sunday: dayHoursSchema,
	})
	.optional();

export const createLocation = createAdminEndpoint(
	"/admin/store-locator/locations/create",
	{
		method: "POST",
		body: z.object({
			name: z
				.string()
				.min(1)
				.transform(sanitizeText)
				.refine((s) => s.length >= 1, "Name is required"),
			slug: z.string().min(1),
			description: z.string().optional(),
			address: z
				.string()
				.min(1)
				.transform(sanitizeText)
				.refine((s) => s.length >= 1, "Address is required"),
			city: z
				.string()
				.min(1)
				.transform(sanitizeText)
				.refine((s) => s.length >= 1, "City is required"),
			state: z.string().optional(),
			postalCode: z.string().optional(),
			country: z.string().min(1),
			latitude: z.number().min(-90).max(90),
			longitude: z.number().min(-180).max(180),
			phone: z.string().optional(),
			email: z.string().email().optional(),
			website: z.string().optional(),
			imageUrl: z.string().optional(),
			hours: weeklyHoursSchema,
			amenities: z.array(z.string()).optional(),
			region: z.string().optional(),
			pickupEnabled: z.boolean().optional(),
			isFeatured: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storeLocator as StoreLocatorController;

		const location = await controller.createLocation(ctx.body);

		return { location };
	},
);
