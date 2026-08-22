import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";

const orderParams = z.object({ id: z.string().max(128) });

function unavailable() {
	return {
		code: "STORE_CUSTOMER_CONTINUITY_REQUIRED",
		error:
			"Order history is unavailable until verified authentication is bound to a Store Customer.",
		status: 503,
	};
}

export const listMyOrdersUnavailable = createStoreEndpoint(
	"/orders/me",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().positive().optional().default(1),
			limit: z.coerce.number().int().positive().max(50).optional().default(10),
		}),
	},
	async () => unavailable(),
);

export const listMyReturnsUnavailable = createStoreEndpoint(
	"/orders/me/returns",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().positive().optional().default(1),
			limit: z.coerce.number().int().positive().max(50).optional().default(10),
			status: z.string().max(50).optional(),
		}),
	},
	async () => unavailable(),
);

export const getMyOrderUnavailable = createStoreEndpoint(
	"/orders/me/:id",
	{ method: "GET", params: orderParams },
	async () => unavailable(),
);

export const getMyInvoiceUnavailable = createStoreEndpoint(
	"/orders/me/:id/invoice",
	{ method: "GET", params: orderParams },
	async () => unavailable(),
);

export const cancelMyOrderUnavailable = createStoreEndpoint(
	"/orders/me/:id/cancel",
	{ method: "POST", params: orderParams },
	async () => unavailable(),
);

export const getMyOrderFulfillmentsUnavailable = createStoreEndpoint(
	"/orders/me/:id/fulfillments",
	{ method: "GET", params: orderParams },
	async () => unavailable(),
);

export const getMyOrderReturnsUnavailable = createStoreEndpoint(
	"/orders/me/:id/returns",
	{ method: "GET", params: orderParams },
	async () => unavailable(),
);

export const reorderUnavailable = createStoreEndpoint(
	"/orders/me/:id/reorder",
	{ method: "POST", params: orderParams },
	async () => unavailable(),
);
