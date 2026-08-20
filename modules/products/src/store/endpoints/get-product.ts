import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { Product, ProductWithVariants } from "../../controllers";

export const getProduct = createStoreEndpoint(
	"/products/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().max(500),
		}),
	},
	async (ctx) => {
		const { params } = ctx;
		const controllers = ctx.context.controllers;

		// Try to get by ID first
		let product = (await controllers.product.getWithVariants(
			ctx,
		)) as ProductWithVariants | null;

		// If not found, try by slug
		if (!product) {
			const bySlug = (await controllers.product.getBySlug({
				...ctx,
				query: { slug: params.id },
			})) as Product | null;
			if (bySlug) {
				product = (await controllers.product.getWithVariants({
					...ctx,
					params: { id: bySlug.id },
				})) as ProductWithVariants | null;
			}
		}

		if (!product) {
			return {
				error: "Product not found",
				status: 404,
			};
		}

		// Only return active products to store
		if (product.status !== "active") {
			return {
				error: "Product not found",
				status: 404,
			};
		}

		return { product };
	},
);
