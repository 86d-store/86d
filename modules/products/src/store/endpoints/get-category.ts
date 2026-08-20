import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { Category, Product } from "../../controllers";

export const getCategory = createStoreEndpoint(
	"/categories/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().max(200),
		}),
		query: z
			.object({
				includeProducts: z.string().max(10).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const { params, query = {} } = ctx;
		const controllers = ctx.context.controllers;

		// Try to get by ID first
		let category = (await controllers.category.getById(ctx)) as Category | null;

		// If not found, try by slug
		if (!category) {
			category = (await controllers.category.getBySlug({
				...ctx,
				query: { slug: params.id },
			})) as Category | null;
		}

		if (!category) {
			return {
				error: "Category not found",
				status: 404,
			};
		}

		// Only return visible categories to store
		if (!category.isVisible) {
			return {
				error: "Category not found",
				status: 404,
			};
		}

		// Optionally include products
		let products: unknown[] | undefined;
		if (query.includeProducts === "true") {
			products = (await controllers.product.getByCategory({
				...ctx,
				params: { categoryId: category.id },
			})) as Product[];
		}

		return {
			category,
			products,
		};
	},
);
