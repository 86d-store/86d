import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type {
	OrderController,
	OrderStatus,
	PaymentStatus,
} from "../../service";

export const adminExportOrders = createAdminEndpoint(
	"/admin/orders/export",
	{
		method: "GET",
		query: z.object({
			limit: z.coerce
				.number()
				.int()
				.positive()
				.max(500)
				.optional()
				.default(500),
			search: z.string().optional(),
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
			dateFrom: z.string().optional(),
			dateTo: z.string().optional(),
		}),
	},
	async (ctx) => {
		const { limit, search, status, paymentStatus, dateFrom, dateTo } =
			ctx.query;

		const controller = ctx.context.controllers.order as OrderController;
		const { orders, total } = await controller.listForExport({
			limit,
			offset: 0,
			...(search !== undefined ? { search } : {}),
			...(status !== undefined ? { status: status as OrderStatus } : {}),
			...(paymentStatus !== undefined
				? { paymentStatus: paymentStatus as PaymentStatus }
				: {}),
			...(dateFrom !== undefined ? { dateFrom: new Date(dateFrom) } : {}),
			...(dateTo !== undefined ? { dateTo: new Date(dateTo) } : {}),
		});

		return { orders, total };
	},
);
