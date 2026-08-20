import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";

export const setStock = createAdminEndpoint(
	"/admin/inventory/set",
	{
		method: "POST",
		body: z.object({
			productId: z.string(),
			variantId: z.string().optional(),
			locationId: z.string().optional(),
			quantity: z.number().int().min(0),
			lowStockThreshold: z.number().int().min(0).optional(),
			allowBackorder: z.boolean().optional(),
			productName: z.string().max(500).optional(),
			variantName: z.string().max(200).optional(),
		}),
	},
	async () => {
		return {
			code: "INVENTORY_SET_COMMAND_UNAVAILABLE",
			error:
				"Setting absolute stock is unavailable until its Inventory Command is registered.",
			status: 503,
		};
	},
);
