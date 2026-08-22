import { provideCapability } from "@86d-app/core/capabilities";
import { storeCreditCheckoutCapability } from "@86d-app/core/commerce-capabilities";
import type { z } from "zod";
import type { StoreCreditController } from "./service";
import { createStoreCreditController } from "./service-impl";

type StoreCreditCheckoutRequest = z.infer<
	typeof storeCreditCheckoutCapability.request
>;

export async function handleStoreCreditCheckout(
	controller: StoreCreditController,
	request: StoreCreditCheckoutRequest,
) {
	if (request.operation === "balance") {
		return {
			ok: true as const,
			decision: {
				operation: "balance" as const,
				balance: await controller.getBalance(request.customerId),
			},
		};
	}
	try {
		const result = await controller.debit({
			customerId: request.customerId,
			amount: request.amount,
			reason: "order_payment",
			description: request.description,
			referenceType: request.referenceType,
			referenceId: request.referenceId,
		});
		return {
			ok: true as const,
			decision: {
				operation: "debit" as const,
				transactionId: result.id,
				amount: result.amount,
				balanceAfter: result.balanceAfter,
			},
		};
	} catch {
		return {
			ok: false as const,
			failure: {
				code: "STORE_CREDIT_DEBIT_FAILED" as const,
				message: "Store credit could not be applied.",
			},
		};
	}
}

export const storeCreditCheckoutProvider = provideCapability(
	storeCreditCheckoutCapability,
	async (ctx, request) =>
		handleStoreCreditCheckout(createStoreCreditController(ctx.data), request),
);
