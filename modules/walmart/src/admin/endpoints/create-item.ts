import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { WalmartController } from "../../service";

export const createItemEndpoint = createAdminEndpoint(
	"/admin/walmart/items/create",
	{
		method: "POST",
		body: z.object({
			localProductId: z.string().min(1).max(200),
			sku: z.string().min(1).max(200),
			title: z.string().min(1).max(500).transform(sanitizeText),
			price: z.number().min(0),
			quantity: z.number().int().min(0).optional(),
			upc: z.string().max(20).optional(),
			gtin: z.string().max(20).optional(),
			brand: z.string().max(200).transform(sanitizeText).optional(),
			category: z.string().max(200).transform(sanitizeText).optional(),
			fulfillmentType: z.enum(["seller", "wfs"]).optional(),
			metadata: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.walmart as WalmartController;
		const item = await controller.createItem({
			localProductId: ctx.body.localProductId,
			sku: ctx.body.sku,
			title: ctx.body.title,
			price: ctx.body.price,
			quantity: ctx.body.quantity,
			upc: ctx.body.upc,
			gtin: ctx.body.gtin,
			brand: ctx.body.brand,
			category: ctx.body.category,
			fulfillmentType: ctx.body.fulfillmentType,
			metadata: ctx.body.metadata,
		});
		return { item };
	},
);
