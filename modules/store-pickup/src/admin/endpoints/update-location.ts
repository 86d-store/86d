import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type {
	StorePickupController,
	UpdateLocationParams,
} from "../../service";

export const updateLocation = createAdminEndpoint(
	"/admin/store-pickup/locations/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			name: z.string().min(1).max(200).optional(),
			address: z.string().min(1).max(500).optional(),
			city: z.string().min(1).max(200).optional(),
			state: z.string().min(1).max(200).optional(),
			postalCode: z.string().min(1).max(20).optional(),
			country: z.string().min(2).max(2).optional(),
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
		const params: UpdateLocationParams = {};
		if (ctx.body.name != null) params.name = ctx.body.name;
		if (ctx.body.address != null) params.address = ctx.body.address;
		if (ctx.body.city != null) params.city = ctx.body.city;
		if (ctx.body.state != null) params.state = ctx.body.state;
		if (ctx.body.postalCode != null) params.postalCode = ctx.body.postalCode;
		if (ctx.body.country != null) params.country = ctx.body.country;
		if (ctx.body.phone != null) params.phone = ctx.body.phone;
		if (ctx.body.email != null) params.email = ctx.body.email;
		if (ctx.body.latitude != null) params.latitude = ctx.body.latitude;
		if (ctx.body.longitude != null) params.longitude = ctx.body.longitude;
		if (ctx.body.preparationMinutes != null)
			params.preparationMinutes = ctx.body.preparationMinutes;
		if (ctx.body.active != null) params.active = ctx.body.active;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;
		const location = await controller.updateLocation(ctx.params.id, params);
		if (!location) {
			return { error: "Location not found", status: 404 };
		}
		return { location };
	},
);
