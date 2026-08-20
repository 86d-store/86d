import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";

export const inventoryStockAdjustTransportSchema = z
	.object({
		productId: z.string().min(1).max(200),
		variantId: z.string().min(1).max(200).optional(),
		locationId: z.string().min(1).max(200).optional(),
		delta: z.number().int().min(-1_000_000).max(1_000_000),
		idempotencyKey: z.string().uuid(),
	})
	.strict();

export const adjustStock = createAdminEndpoint(
	"/admin/inventory/adjust",
	{
		method: "POST",
		body: inventoryStockAdjustTransportSchema,
	},
	async () => {
		return {
			code: "INVENTORY_COMMAND_TRANSPORT_REQUIRED",
			error:
				"Inventory adjustment must be executed by the authenticated Store Command transport.",
			status: 503,
		};
	},
);
