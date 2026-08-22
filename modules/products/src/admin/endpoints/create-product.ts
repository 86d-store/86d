import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { Product } from "../../controllers";

export const createProduct = createAdminEndpoint(
	"/admin/products/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200),
			description: z.string().max(10000).transform(sanitizeText).optional(),
			shortDescription: z.string().max(500).transform(sanitizeText).optional(),
			price: z.number().int().positive(),
			compareAtPrice: z.number().int().positive().optional(),
			costPrice: z.number().int().positive().optional(),
			sku: z.string().max(100).optional(),
			barcode: z.string().max(100).optional(),
			inventory: z.number().int().min(0).optional(),
			trackInventory: z.boolean().optional(),
			allowBackorder: z.boolean().optional(),
			status: z.enum(["draft", "active", "archived"]).optional(),
			categoryId: z.string().optional(),
			images: z.array(z.string()).optional(),
			tags: z.array(z.string()).optional(),
			metadata: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many metadata keys")
				.optional(),
			weight: z.number().positive().optional(),
			weightUnit: z.enum(["kg", "lb", "oz", "g"]).optional(),
			isFeatured: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const { body } = ctx;
		const controllers = ctx.context.controllers;
		if (
			body.inventory !== undefined ||
			body.trackInventory !== undefined ||
			body.allowBackorder !== undefined
		) {
			return {
				code: "INVENTORY_OPERATION_REQUIRED",
				error: "Stock must be changed through the Inventory operation.",
				status: 409,
			};
		}

		// Check if slug is unique
		const existingProduct = await controllers.product.getBySlug({
			...ctx,
			query: { slug: body.slug },
		});
		if (existingProduct) {
			return {
				error: "A product with this slug already exists",
				status: 400,
			};
		}

		const product = (await controllers.product.create(ctx)) as Product;

		void ctx.context.events?.emit("product.created", {
			productId: product.id,
			name: product.name,
			slug: product.slug,
			price: product.price,
			status: product.status,
		});
		return { product, status: 201 };
	},
);
