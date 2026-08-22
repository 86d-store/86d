import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ComparisonController } from "../../service";

export const addProduct = createStoreEndpoint(
	"/comparisons/add",
	{
		method: "POST",
		body: z.object({
			productId: z.string().max(200),
			productName: z.string().max(500).transform(sanitizeText),
			productSlug: z.string().max(500).transform(sanitizeText),
			productImage: z
				.string()
				.max(2000)
				.optional()
				.transform((s) => (s === undefined ? undefined : sanitizeText(s))),
			productPrice: z.number().min(0).optional(),
			productCategory: z.string().max(200).transform(sanitizeText).optional(),
			attributes: z
				.record(
					z.string().max(100).transform(sanitizeText),
					z.string().max(500).transform(sanitizeText),
				)
				.refine((r) => Object.keys(r).length <= 50, "Too many attributes")
				.optional(),
			sessionId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.comparisons as ComparisonController;
		const customerId = ctx.context.session?.user.id;

		const maxProducts = Number(
			(ctx.context.options as Record<string, unknown>).maxProducts,
		);

		try {
			const item = await controller.addProduct({
				customerId,
				sessionId: !customerId ? ctx.body.sessionId : undefined,
				productId: ctx.body.productId,
				productName: ctx.body.productName,
				productSlug: ctx.body.productSlug,
				productImage: ctx.body.productImage,
				productPrice: ctx.body.productPrice,
				productCategory: ctx.body.productCategory,
				attributes: ctx.body.attributes as Record<string, string> | undefined,
				maxProducts: Number.isFinite(maxProducts) ? maxProducts : undefined,
			});
			return { item };
		} catch {
			return { error: "Failed to add product", status: 400 };
		}
	},
);
