import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import { resolveOrderCustomerContext } from "./customer-context";

function collectGuestProofs(cookieHeader: string | null): string[] {
	if (!cookieHeader) return [];
	const proofs: string[] = [];
	for (const part of cookieHeader.split(";")) {
		const [name, ...rest] = part.trim().split("=");
		if (
			name?.startsWith("checkout_guest_") ||
			name?.startsWith("order_guest_")
		) {
			const value = rest.join("=");
			if (value.length >= 16) proofs.push(value);
		}
	}
	return proofs.slice(0, 8);
}

export const claimGuestOrder = createStoreEndpoint(
	"/orders/claim",
	{
		method: "POST",
		body: z.object({
			orderId: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const customerContext = await resolveOrderCustomerContext(ctx.context);
		if (!customerContext.ok) return customerContext.response;

		const result = await customerContext.controller.claimGuestOrder({
			orderId: ctx.body.orderId,
			storeCustomerId: customerContext.customerId,
			proofs: collectGuestProofs(ctx.headers?.get("cookie") ?? null),
		});
		if (!result.ok) {
			return { error: "Order not found", status: 404 };
		}

		return { order: result.order, claimed: result.claimed };
	},
);
