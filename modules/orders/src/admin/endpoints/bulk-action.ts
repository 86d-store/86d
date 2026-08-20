import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";

export const adminBulkAction = createAdminEndpoint(
	"/admin/orders/bulk",
	{
		method: "POST",
		body: z.object({
			action: z.enum(["updateStatus", "updatePaymentStatus", "delete"]),
			ids: z.array(z.string()).min(1),
			status: z
				.enum([
					"pending",
					"processing",
					"on_hold",
					"completed",
					"cancelled",
					"refunded",
				])
				.optional(),
			paymentStatus: z
				.enum(["unpaid", "paid", "partially_paid", "refunded", "voided"])
				.optional(),
		}),
	},
	async () => {
		return {
			code: "ORDER_BULK_OPERATION_UNAVAILABLE",
			error:
				"Bulk Order status, Payment status, and deletion operations are unavailable because they bypass owning workflows.",
			status: 503,
		};
	},
);
