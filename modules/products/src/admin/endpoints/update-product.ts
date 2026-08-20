import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { Product } from "../../controllers";

export const updateProduct = createAdminEndpoint(
	"/admin/products/:id/update",
	{
		method: "PUT",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			slug: z.string().min(1).max(200).optional(),
			description: z.string().max(10000).transform(sanitizeText).optional(),
			shortDescription: z.string().max(500).transform(sanitizeText).optional(),
			price: z.number().int().positive().optional(),
			compareAtPrice: z.number().int().positive().nullable().optional(),
			costPrice: z.number().int().positive().nullable().optional(),
			sku: z.string().max(100).nullable().optional(),
			barcode: z.string().max(100).nullable().optional(),
			inventory: z.number().int().min(0).optional(),
			trackInventory: z.boolean().optional(),
			allowBackorder: z.boolean().optional(),
			status: z.enum(["draft", "active", "archived"]).optional(),
			categoryId: z.string().nullable().optional(),
			images: z.array(z.string()).optional(),
			tags: z.array(z.string()).optional(),
			metadata: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many metadata keys")
				.optional(),
			weight: z.number().positive().nullable().optional(),
			weightUnit: z.enum(["kg", "lb", "oz", "g"]).nullable().optional(),
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

		// Check if product exists
		const existingProduct = (await controllers.product.getById(
			ctx,
		)) as Product | null;
		if (!existingProduct) {
			return {
				error: "Product not found",
				status: 404,
			};
		}

		// If slug is being changed, check uniqueness
		if (body.slug && body.slug !== existingProduct.slug) {
			const productWithSlug = await controllers.product.getBySlug({
				...ctx,
				query: { slug: body.slug },
			});
			if (productWithSlug) {
				return {
					error: "A product with this slug already exists",
					status: 400,
				};
			}
		}

		const product = (await controllers.product.update(ctx)) as Product | null;

		if (product) {
			void ctx.context.events?.emit("product.updated", {
				productId: product.id,
				name: product.name,
				slug: product.slug,
				price: product.price,
				status: product.status,
			});
		}
		return { product };
	},
);
