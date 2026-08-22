import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type {
	OrderController,
	OrderStatus,
	PaymentStatus,
} from "../../service";

export const adminListOrders = createAdminEndpoint(
	"/admin/orders",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().positive().optional().default(1),
			limit: z.coerce.number().int().positive().max(100).optional().default(20),
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
		}),
	},
	async (ctx) => {
		const { page, limit, search, status, paymentStatus } = ctx.query;
		const offset = (page - 1) * limit;

		const controller = ctx.context.controllers.order as OrderController;
		const { orders, total } = await controller.list({
			limit,
			offset,
			...(search !== undefined ? { search } : {}),
			...(status !== undefined ? { status: status as OrderStatus } : {}),
			...(paymentStatus !== undefined
				? { paymentStatus: paymentStatus as PaymentStatus }
				: {}),
		});

		return {
			orders,
			total,
			page,
			limit,
			pages: Math.ceil(total / limit),
		};
	},
);
