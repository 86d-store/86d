import { createStoreEndpoint } from "@86d-app/core/api";

export const checkoutActivationUnavailable = {
	code: "CHECKOUT_ACTIVATION_UNAVAILABLE",
	error:
		"Checkout activation is unavailable until authoritative commerce decisions and duplicate-safe completion are configured.",
	status: 503,
} as const;

function createUnavailableEndpoint<Path extends string>(path: Path) {
	return createStoreEndpoint(path, { method: "POST" }, async () => ({
		...checkoutActivationUnavailable,
	}));
}

export const confirmSessionUnavailable = createUnavailableEndpoint(
	"/checkout/sessions/:id/confirm",
);
export const createPaymentUnavailable = createUnavailableEndpoint(
	"/checkout/sessions/:id/payment",
);
export const capturePaymentUnavailable = createUnavailableEndpoint(
	"/checkout/sessions/:id/payment/capture",
);
export const getPaymentUnavailable = createStoreEndpoint(
	"/checkout/sessions/:id/payment/status",
	{ method: "GET" },
	async () => ({ ...checkoutActivationUnavailable }),
);
export const completeSessionUnavailable = createUnavailableEndpoint(
	"/checkout/sessions/:id/complete",
);
