import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";

const unavailable = {
	code: "FULFILLMENT_WORKFLOW_REQUIRED",
	error:
		"This Fulfillment transition requires a durable workflow with the owning Shipping and commerce operations.",
	status: 503,
};

export const updateStatusUnavailable = createAdminEndpoint(
	"/admin/fulfillment/:id/status",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
		body: z.object({
			status: z.enum([
				"pending",
				"processing",
				"shipped",
				"delivered",
				"cancelled",
			]),
		}),
	},
	async () => unavailable,
);

export const addTrackingUnavailable = createAdminEndpoint(
	"/admin/fulfillment/:id/tracking",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
		body: z.object({
			carrier: z.string().min(1).max(100).transform(sanitizeText),
			trackingNumber: z.string().min(1).max(200).transform(sanitizeText),
			trackingUrl: z.string().url().max(2000).optional(),
		}),
	},
	async () => unavailable,
);

export const cancelFulfillmentUnavailable = createAdminEndpoint(
	"/admin/fulfillment/:id/cancel",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
	},
	async () => unavailable,
);
