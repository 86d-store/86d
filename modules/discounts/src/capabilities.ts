import { provideCapability } from "@86d-app/core/capabilities";
import { discountCodeCapability } from "@86d-app/core/commerce-capabilities";
import type { z } from "@86d-app/core/zod";
import type { DiscountController } from "./service";
import { createDiscountController } from "./service-impl";

export { discountCodeCapability };

type DiscountCodeRequest = z.infer<typeof discountCodeCapability.request>;

export async function handleDiscountCode(
	controller: DiscountController,
	request: DiscountCodeRequest,
) {
	try {
		const params = {
			code: request.code,
			subtotal: request.subtotal,
			productIds: request.productIds,
			categoryIds: request.categoryIds,
		};
		const result =
			request.operation === "commit"
				? await controller.applyCode(params)
				: await controller.validateCode(params);
		return {
			ok: true as const,
			decision: {
				valid: result.valid,
				discountAmount: result.discountAmount,
				freeShipping: result.freeShipping,
				...(result.error ? { error: result.error } : {}),
			},
		};
	} catch {
		return {
			ok: false as const,
			failure: {
				code: "DISCOUNT_PROVIDER_FAILED" as const,
				message: "The discount decision could not be completed.",
			},
		};
	}
}

export const discountCodeProvider = provideCapability(
	discountCodeCapability,
	async (ctx, request) =>
		handleDiscountCode(createDiscountController(ctx.data), request),
);
