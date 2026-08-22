import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import { createCheckoutRequestStore } from "../../checkout-request";
import {
	canAccessCheckoutRequest,
	publicCheckoutRequest,
} from "./checkout-request-access";

export const getCheckoutRequest = createStoreEndpoint(
	"/checkout/requests/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().min(1).max(100) }).strict(),
	},
	async (ctx) => {
		const result = await createCheckoutRequestStore(
			ctx.context.transactions,
		).getById(ctx.params.id);
		if (!result.ok) {
			if (result.code === "REQUEST_NOT_FOUND") {
				return { error: "Checkout Request not found", status: 404 };
			}
			return {
				code: `CHECKOUT_REQUEST_${result.code}`,
				error: result.message,
				status: 503,
			};
		}
		if (!(await canAccessCheckoutRequest(ctx, result.request))) {
			return { error: "Checkout Request not found", status: 404 };
		}
		if (result.request.expiresAt.getTime() <= Date.now()) {
			return {
				code: "CHECKOUT_REQUEST_EXPIRED",
				error: "This Checkout Request has expired.",
				status: 410,
			};
		}
		return { request: publicCheckoutRequest(result.request) };
	},
);
