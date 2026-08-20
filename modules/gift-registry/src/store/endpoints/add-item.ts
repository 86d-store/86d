import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { AddItemParams, GiftRegistryController } from "../../service";

export const addItem = createStoreEndpoint(
	"/gift-registry/items/add",
	{
		method: "POST",
		body: z.object({
			registryId: z.string().max(200),
			productId: z.string().max(200),
			productName: z.string().min(1).max(300).transform(sanitizeText),
			variantId: z.string().max(200).optional(),
			variantName: z.string().max(200).transform(sanitizeText).optional(),
			imageUrl: z.string().url().max(2048).optional(),
			priceInCents: z.number().int().min(1),
			quantityDesired: z.number().int().min(1).max(100).optional(),
			priority: z.enum(["must_have", "nice_to_have", "dream"]).optional(),
			note: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const registry = await controller.getRegistry(ctx.body.registryId);
		if (!registry || registry.customerId !== userId) {
			return { error: "Registry not found", status: 404 };
		}

		const params: AddItemParams = {
			registryId: ctx.body.registryId,
			productId: ctx.body.productId,
			productName: ctx.body.productName,
			priceInCents: ctx.body.priceInCents,
		};
		if (ctx.body.variantId) params.variantId = ctx.body.variantId;
		if (ctx.body.variantName) params.variantName = ctx.body.variantName;
		if (ctx.body.imageUrl) params.imageUrl = ctx.body.imageUrl;
		if (ctx.body.quantityDesired != null)
			params.quantityDesired = ctx.body.quantityDesired;
		if (ctx.body.priority) params.priority = ctx.body.priority;
		if (ctx.body.note) params.note = ctx.body.note;

		const item = await controller.addItem(params);
		return { item };
	},
);
