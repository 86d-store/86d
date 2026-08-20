import { provideCapability } from "@86d-app/core/capabilities";
import {
	paymentCheckoutCapability,
	paymentIntentCapability,
} from "@86d-app/core/commerce-capabilities";
import type { z } from "@86d-app/core/zod";
import type { PaymentController, PaymentProvider } from "./service";
import { createPaymentController } from "./service-impl";

export { paymentCheckoutCapability, paymentIntentCapability };

type PaymentCheckoutRequest = z.infer<typeof paymentCheckoutCapability.request>;

function clientAction(providerMetadata: Record<string, unknown>) {
	if (
		typeof providerMetadata.clientSecret === "string" &&
		providerMetadata.clientSecret.length > 0 &&
		providerMetadata.clientSecret.length <= 4096
	) {
		return {
			type: "client_secret" as const,
			clientSecret: providerMetadata.clientSecret,
		};
	}
	if (
		providerMetadata.paymentType === "paypal" &&
		typeof providerMetadata.paypalOrderId === "string" &&
		providerMetadata.paypalOrderId.length > 0 &&
		providerMetadata.paypalOrderId.length <= 500
	) {
		return {
			type: "paypal_approval" as const,
			orderId: providerMetadata.paypalOrderId,
		};
	}
	if (
		providerMetadata.paymentType === "braintree" &&
		typeof providerMetadata.braintreeClientToken === "string" &&
		providerMetadata.braintreeClientToken.length > 0 &&
		providerMetadata.braintreeClientToken.length <= 4096
	) {
		return {
			type: "braintree_tokenize" as const,
			clientToken: providerMetadata.braintreeClientToken,
		};
	}
	if (providerMetadata.paymentType === "square") {
		return { type: "square_tokenize" as const };
	}
	return undefined;
}

function intentDecision(
	operation: PaymentCheckoutRequest["operation"],
	intent: Awaited<ReturnType<PaymentController["getIntent"]>> & {},
) {
	const action = clientAction(intent.providerMetadata);
	return {
		operation,
		id: intent.id,
		status: intent.status,
		amount: intent.amount,
		currency: intent.currency,
		...(action ? { clientAction: action } : {}),
	};
}

export async function handlePaymentCheckout(
	controller: PaymentController,
	request: PaymentCheckoutRequest,
) {
	try {
		const intent =
			request.operation === "create"
				? await controller.createIntent(request)
				: request.operation === "get"
					? await controller.getIntent(request.intentId)
					: request.operation === "confirm"
						? await controller.confirmIntent(request.intentId)
						: await controller.cancelIntent(request.intentId);
		if (!intent) {
			return {
				ok: false as const,
				failure: {
					code: "PAYMENT_NOT_FOUND" as const,
					message: "Payment intent not found.",
				},
			};
		}
		return {
			ok: true as const,
			decision: intentDecision(request.operation, intent),
		};
	} catch {
		return {
			ok: false as const,
			failure: {
				code: "PAYMENT_OPERATION_FAILED" as const,
				message: "The payment operation could not be completed.",
			},
		};
	}
}

export function createPaymentCheckoutProvider(provider?: PaymentProvider) {
	return provideCapability(paymentCheckoutCapability, async (ctx, request) =>
		handlePaymentCheckout(createPaymentController(ctx.data, provider), request),
	);
}

function paymentIntentDecision(
	intent: NonNullable<Awaited<ReturnType<PaymentController["getIntent"]>>>,
) {
	return {
		id: intent.id,
		...(intent.providerIntentId
			? { providerIntentId: intent.providerIntentId }
			: {}),
		...(intent.customerId ? { customerId: intent.customerId } : {}),
		...(intent.email ? { email: intent.email } : {}),
		amount: intent.amount,
		currency: intent.currency,
		status: intent.status,
		...(intent.orderId ? { orderId: intent.orderId } : {}),
		createdAt: intent.createdAt,
		updatedAt: intent.updatedAt,
	};
}

export function createPaymentIntentProvider(
	provider?: PaymentProvider,
	options?: { allowOfflineForDevelopment?: boolean | undefined },
) {
	return provideCapability(paymentIntentCapability, async (ctx, request) => {
		const controller = createPaymentController(ctx.data, provider, options);
		try {
			if (request.operation === "get") {
				const intent = await controller.getIntent(request.intentId);
				if (!intent) {
					return {
						ok: false,
						failure: { code: "PAYMENT_NOT_FOUND" as const },
					};
				}
				return {
					ok: true,
					decision: {
						operation: "get" as const,
						intent: paymentIntentDecision(intent),
					},
				};
			}
			if (request.operation === "list") {
				const intents = await controller.listIntents(request);
				return {
					ok: true,
					decision: {
						operation: "list" as const,
						intents: intents.map(paymentIntentDecision),
					},
				};
			}
			const refund = await controller.createRefund(request);
			return {
				ok: true,
				decision: {
					operation: "refund" as const,
					refund: {
						id: refund.id,
						amount: refund.amount,
						status: refund.status,
					},
				},
			};
		} catch {
			return {
				ok: false,
				failure: { code: "PAYMENT_OPERATION_FAILED" as const },
			};
		}
	});
}
