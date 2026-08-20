import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
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

export const updateLocation = createAdminEndpoint(
	"/admin/store-locator/locations/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			name: z.string().min(1).transform(sanitizeText).optional(),
			slug: z.string().min(1).optional(),
			description: z.string().optional(),
			address: z.string().min(1).transform(sanitizeText).optional(),
			city: z.string().min(1).transform(sanitizeText).optional(),
			state: z.string().optional(),
			postalCode: z.string().optional(),
			country: z.string().optional(),
			latitude: z.number().min(-90).max(90).optional(),
			longitude: z.number().min(-180).max(180).optional(),
			phone: z.string().optional(),
			email: z.string().email().optional(),
			website: z.string().optional(),
			imageUrl: z.string().optional(),
			hours: weeklyHoursSchema,
			amenities: z.array(z.string()).optional(),
			region: z.string().optional(),
			isActive: z.boolean().optional(),
			isFeatured: z.boolean().optional(),
			pickupEnabled: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storeLocator as StoreLocatorController;

		const location = await controller.updateLocation(ctx.params.id, ctx.body);

		return { location };
	},
);
