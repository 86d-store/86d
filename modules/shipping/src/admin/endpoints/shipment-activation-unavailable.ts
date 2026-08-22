import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";

const unavailable = {
	code: "SHIPPING_FULFILLMENT_WORKFLOW_REQUIRED",
	error:
		"Shipment mutations require a fulfillment-linked, Connection-bound durable Shipping operation.",
	status: 503,
};

export const createShipmentUnavailable = createAdminEndpoint(
	"/admin/shipping/shipments/create",
	{
		method: "POST",
		body: z.object({
			orderId: z.string().min(1).max(200),
			carrierId: z.string().optional(),
			methodId: z.string().optional(),
			trackingNumber: z.string().max(200).transform(sanitizeText).optional(),
			estimatedDelivery: z.coerce.date().optional(),
			notes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async () => unavailable,
);

export const updateShipmentUnavailable = createAdminEndpoint(
	"/admin/shipping/shipments/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			carrierId: z.string().optional(),
			methodId: z.string().optional(),
			trackingNumber: z.string().max(200).transform(sanitizeText).optional(),
			estimatedDelivery: z.coerce.date().optional(),
			notes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async () => unavailable,
);

export const updateShipmentStatusUnavailable = createAdminEndpoint(
	"/admin/shipping/shipments/:id/status",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			status: z.enum([
				"pending",
				"shipped",
				"in_transit",
				"delivered",
				"returned",
				"failed",
			]),
		}),
	},
	async () => unavailable,
);

export const deleteShipmentUnavailable = createAdminEndpoint(
	"/admin/shipping/shipments/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async () => unavailable,
);
