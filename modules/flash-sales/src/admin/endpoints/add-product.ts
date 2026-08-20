import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { FlashSaleController } from "../../service";

export const addProduct = createAdminEndpoint(
	"/admin/flash-sales/:id/products/add",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			productId: z.string().min(1),
			productName: z.string().max(500).transform(sanitizeText).optional(),
			productSlug: z.string().max(500).transform(sanitizeText).optional(),
			productImage: z.string().url().max(2000).optional(),
			salePrice: z.number().min(0),
			originalPrice: z.number().min(0),
			stockLimit: z.number().int().min(1).optional(),
			sortOrder: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		const sale = await controller.getFlashSale(ctx.params.id);
		if (!sale) {
			return { error: "Flash sale not found", status: 404 };
		}

		if (ctx.body.salePrice >= ctx.body.originalPrice) {
			return {
				error: "Sale price must be less than original price",
				status: 400,
			};
		}

		const params: Parameters<typeof controller.addProduct>[0] = {
			flashSaleId: ctx.params.id,
			productId: ctx.body.productId,
			salePrice: ctx.body.salePrice,
			originalPrice: ctx.body.originalPrice,
		};
		if (ctx.body.productName) params.productName = ctx.body.productName;
		if (ctx.body.productSlug) params.productSlug = ctx.body.productSlug;
		if (ctx.body.productImage) params.productImage = ctx.body.productImage;
		if (ctx.body.stockLimit != null) params.stockLimit = ctx.body.stockLimit;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;

		const product = await controller.addProduct(params);

		return { product };
	},
);
