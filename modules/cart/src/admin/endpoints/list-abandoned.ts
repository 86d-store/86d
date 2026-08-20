import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CartItem } from "../../service";
import { createCartControllers } from "../../service-impl";

export const listAbandonedCarts = createAdminEndpoint(
	"/admin/carts/abandoned",
	{
		method: "GET",
		query: z
			.object({
				page: z.string().optional(),
				limit: z.string().optional(),
				thresholdHours: z.string().optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const { query = {} } = ctx;
		const context = ctx.context;
		const controller = createCartControllers(context.data);

		const page = query.page ? Number.parseInt(query.page, 10) : 1;
		const limit = query.limit ? Number.parseInt(query.limit, 10) : 20;
		const skip = (page - 1) * limit;
		const thresholdHours = query.thresholdHours
			? Number.parseInt(query.thresholdHours, 10)
			: 1;

		const allCarts = await controller.getAbandonedCarts({
			thresholdHours,
		});

		// Enrich each cart with items and subtotal
		const allEnriched = await Promise.all(
			allCarts.map(async (cart) => {
				const items = (await context.data.findMany("cartItem", {
					where: { cartId: cart.id },
				})) as CartItem[];

				const subtotal = items.reduce(
					(sum, i) => sum + i.price * i.quantity,
					0,
				);

				const meta = (cart.metadata ?? {}) as Record<string, unknown>;

				return {
					...cart,
					items,
					itemCount: items.length,
					subtotal,
					recoveryEmailSentAt: meta.recoveryEmailSentAt ?? null,
					recoveryEmailCount:
						typeof meta.recoveryEmailCount === "number"
							? meta.recoveryEmailCount
							: 0,
				};
			}),
		);

		const total = allEnriched.length;
		const carts = allEnriched.slice(skip, skip + limit);

		return {
			carts,
			page,
			limit,
			total,
		};
	},
);
