import { createStoreEndpoint } from "@86d-app/core/api";
import { inventoryCheckoutCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "zod";
import type { CheckoutController } from "../../service";

export const confirmSession = createStoreEndpoint(
	"/checkout/sessions/:id/confirm",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.checkout as CheckoutController;
		const existing = await controller.getById(ctx.params.id);
		if (!existing) {
			return { error: "Checkout session not found", status: 404 };
		}

		// Ownership check
		const userId = ctx.context.session?.user.id;
		if (existing.customerId && (!userId || existing.customerId !== userId)) {
			return { error: "Checkout session not found", status: 404 };
		}

		const inventoryEnabled = ctx.context.modules.includes("inventory");
		if (inventoryEnabled) {
			const lineItems = await controller.getLineItems(ctx.params.id);
			const outOfStock: string[] = [];

			for (const item of lineItems) {
				const stock = await ctx.context.capabilities.invoke(
					inventoryCheckoutCapability,
					{
						operation: "check",
						productId: item.productId,
						...(item.variantId ? { variantId: item.variantId } : {}),
						quantity: item.quantity,
					},
				);
				if (!stock.ok) {
					return {
						code: "CHECKOUT_INVENTORY_UNAVAILABLE",
						error: "An authoritative inventory decision is unavailable.",
						status: 503,
					};
				}
				if (!stock.decision.available) {
					outOfStock.push(item.name);
				}
			}

			if (outOfStock.length > 0) {
				return {
					error: `Insufficient stock for: ${outOfStock.join(", ")}`,
					status: 422,
				};
			}
		}

		// Transition session to "processing"
		const result = await controller.confirm(ctx.params.id);
		if ("error" in result) {
			return result;
		}

		// Reserve stock for all line items
		if (inventoryEnabled) {
			const lineItems = await controller.getLineItems(ctx.params.id);
			for (const item of lineItems) {
				const reserved = await ctx.context.capabilities.invoke(
					inventoryCheckoutCapability,
					{
						operation: "reserve",
						productId: item.productId,
						...(item.variantId ? { variantId: item.variantId } : {}),
						quantity: item.quantity,
					},
				);
				if (!reserved.ok) {
					return {
						code: "CHECKOUT_INVENTORY_UNAVAILABLE",
						error: "Inventory could not reserve the requested quantity.",
						status: 422,
					};
				}
			}
		}

		return { session: result.session };
	},
);
