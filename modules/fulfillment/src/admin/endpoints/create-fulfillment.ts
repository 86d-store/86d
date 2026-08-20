import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import { FulfillmentAuthorityError } from "../../authority";
import type { FulfillmentController } from "../../service";

export const createFulfillment = createAdminEndpoint(
	"/admin/fulfillment/create",
	{
		method: "POST",
		body: z.object({
			orderId: z.string().min(1).max(200),
			items: z
				.array(
					z.object({
						lineItemId: z.string().min(1).max(200),
						quantity: z.number().int().min(1).max(1_000_000),
					}),
				)
				.min(1)
				.max(1_000),
			notes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.fulfillment as FulfillmentController;
		try {
			const fulfillment = await controller.createFulfillment({
				orderId: ctx.body.orderId,
				items: ctx.body.items,
				notes: ctx.body.notes,
			});
			return { fulfillment };
		} catch (error) {
			if (error instanceof FulfillmentAuthorityError) {
				if (error.code === "ORDER_NOT_FOUND") {
					return { code: error.code, error: error.message, status: 404 };
				}
				if (
					error.code === "ORDER_NOT_FULFILLABLE" ||
					error.code === "FULFILLMENT_QUANTITY_EXCEEDED"
				) {
					return { code: error.code, error: error.message, status: 409 };
				}
				if (error.code === "ORDER_LINE_INVALID") {
					return { code: error.code, error: error.message, status: 422 };
				}
				return { code: error.code, error: error.message, status: 503 };
			}
			return {
				code: "FULFILLMENT_AUTHORITY_UNAVAILABLE",
				error: "Fulfillment authority is unavailable.",
				status: 503,
			};
		}
	},
);
