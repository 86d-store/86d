import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ProductVariant } from "../../controllers";

export const updateVariant = createAdminEndpoint(
	"/admin/variants/:id/update",
	{
		method: "PUT",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			sku: z.string().max(100).nullable().optional(),
			barcode: z.string().max(100).nullable().optional(),
			price: z.number().int().positive().optional(),
			compareAtPrice: z.number().int().positive().nullable().optional(),
			costPrice: z.number().int().positive().nullable().optional(),
			inventory: z.number().int().min(0).optional(),
			options: z.record(z.string(), z.string()).optional(),
			images: z.array(z.string()).optional(),
			weight: z.number().positive().nullable().optional(),
			weightUnit: z.enum(["kg", "lb", "oz", "g"]).nullable().optional(),
			position: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const { body } = ctx;
		const controllers = ctx.context.controllers;
		if (body.inventory !== undefined) {
			return {
				code: "INVENTORY_OPERATION_REQUIRED",
				error: "Stock must be changed through the Inventory operation.",
				status: 409,
			};
		}

		// Check if variant exists
		const existingVariant = (await controllers.variant.getById(
			ctx,
		)) as ProductVariant | null;
		if (!existingVariant) {
			return {
				error: "Variant not found",
				status: 404,
			};
		}

		const variant = (await controllers.variant.update(
			ctx,
		)) as ProductVariant | null;

		return { variant };
	},
);
