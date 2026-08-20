import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";

const unavailable = {
	code: "PAYMENT_METHODS_V2_REQUIRED",
	error:
		"Saved Payment methods require verified Store Customer identity and an explicit Payment Connection.",
	status: 503,
};

export const listPaymentMethodsUnavailable = createStoreEndpoint(
	"/payments/methods",
	{ method: "GET" },
	async () => unavailable,
);

export const deletePaymentMethodUnavailable = createStoreEndpoint(
	"/payments/methods/:id",
	{
		method: "DELETE",
		params: z.object({ id: z.string().max(200) }),
	},
	async () => unavailable,
);
