import { createAdminEndpoint } from "@86d-app/core/api";

export const adminExpireStale = createAdminEndpoint(
	"/admin/checkout/expire-stale",
	{
		method: "POST",
	},
	async () => {
		return {
			code: "CHECKOUT_EXPIRY_WORKFLOW_REQUIRED",
			error:
				"Checkout expiry is unavailable until reservation release and payment reconciliation run as a durable workflow.",
			status: 503,
		};
	},
);
