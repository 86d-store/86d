import { provideCapability } from "@86d-app/core/capabilities";
import { productResolveCapability } from "@86d-app/core/commerce-capabilities";
import { createProductController } from "./service-impl";

export { productResolveCapability };

export const productResolveProvider = provideCapability(
	productResolveCapability,
	async (ctx, request) => {
		const controller = createProductController(ctx.data);
		const product = await controller.getProduct(request.productId);
		if (!product) {
			return { ok: false, failure: { code: "not_found" as const } };
		}
		if (product.status !== "active") {
			return { ok: false, failure: { code: "not_active" as const } };
		}
		if (!Number.isSafeInteger(product.price) || product.price < 0) {
			return { ok: false, failure: { code: "invalid_price" as const } };
		}

		let variant:
			| {
					id: string;
					productId: string;
					name: string;
					price: number;
					sku?: string;
					images: string[];
			  }
			| undefined;
		if (request.variantId) {
			const resolved = await controller.getVariant(request.variantId);
			if (!resolved) {
				return {
					ok: false,
					failure: { code: "variant_not_found" as const },
				};
			}
			if (resolved.productId !== product.id) {
				return { ok: false, failure: { code: "variant_mismatch" as const } };
			}
			if (!Number.isSafeInteger(resolved.price) || resolved.price < 0) {
				return { ok: false, failure: { code: "invalid_price" as const } };
			}
			variant = {
				id: resolved.id,
				productId: resolved.productId,
				name: resolved.name,
				price: resolved.price,
				...(resolved.sku ? { sku: resolved.sku } : {}),
				images: resolved.images,
			};
		}

		return {
			ok: true,
			decision: {
				product: {
					id: product.id,
					name: product.name,
					slug: product.slug,
					status: "active" as const,
					price: product.price,
					...(product.sku ? { sku: product.sku } : {}),
					images: product.images,
				},
				...(variant ? { variant } : {}),
			},
		} as const;
	},
);
