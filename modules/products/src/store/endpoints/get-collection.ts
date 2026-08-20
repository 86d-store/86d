import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { Collection, CollectionWithProducts } from "../../controllers";

export const getCollection = createStoreEndpoint(
	"/collections/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().max(200),
		}),
	},
	async (ctx) => {
		const { params } = ctx;
		const controllers = ctx.context.controllers;

		// Try by ID first
		let collection = (await controllers.collection.getWithProducts(
			ctx,
		)) as CollectionWithProducts | null;

		// If not found, try by slug
		if (!collection) {
			const bySlug = (await controllers.collection.getBySlug({
				...ctx,
				query: { slug: params.id },
			})) as Collection | null;
			if (bySlug) {
				collection = (await controllers.collection.getWithProducts({
					...ctx,
					params: { id: bySlug.id },
				})) as CollectionWithProducts | null;
			}
		}

		if (!collection) {
			return { error: "Collection not found", status: 404 };
		}

		// Only return visible collections to store
		if (!collection.isVisible) {
			return { error: "Collection not found", status: 404 };
		}

		return { collection };
	},
);
