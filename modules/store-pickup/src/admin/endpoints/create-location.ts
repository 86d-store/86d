import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type {
	CreateLocationParams,
	StorePickupController,
} from "../../service";

export const createLocation = createAdminEndpoint(
	"/admin/store-pickup/locations/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200),
			address: z.string().min(1).max(500),
			city: z.string().min(1).max(200),
			state: z.string().min(1).max(200),
			postalCode: z.string().min(1).max(20),
			country: z.string().min(2).max(2),
			phone: z.string().max(50).optional(),
			email: z.string().email().max(200).optional(),
			latitude: z.number().min(-90).max(90).optional(),
			longitude: z.number().min(-180).max(180).optional(),
			preparationMinutes: z.number().int().min(0).optional(),
			active: z.boolean().optional(),
			sortOrder: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const params: CreateLocationParams = {
			name: ctx.body.name,
			address: ctx.body.address,
			city: ctx.body.city,
			state: ctx.body.state,
			postalCode: ctx.body.postalCode,
			country: ctx.body.country,
		};
		if (ctx.body.phone != null) params.phone = ctx.body.phone;
		if (ctx.body.email != null) params.email = ctx.body.email;
		if (ctx.body.latitude != null) params.latitude = ctx.body.latitude;
		if (ctx.body.longitude != null) params.longitude = ctx.body.longitude;
		if (ctx.body.preparationMinutes != null)
			params.preparationMinutes = ctx.body.preparationMinutes;
		if (ctx.body.active != null) params.active = ctx.body.active;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;
		const location = await controller.createLocation(params);
		return { location };
	},
);
