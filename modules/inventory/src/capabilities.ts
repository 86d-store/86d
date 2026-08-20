import { provideCapability } from "@86d-app/core/capabilities";
import { inventoryCheckoutCapability } from "@86d-app/core/commerce-capabilities";
import type { z } from "@86d-app/core/zod";
import type { InventoryController } from "./service";
import { createInventoryController } from "./service-impl";

export { inventoryCheckoutCapability };

type InventoryCheckoutRequest = z.infer<
	typeof inventoryCheckoutCapability.request
>;

export async function handleInventoryCheckout(
	controller: InventoryController,
	request: InventoryCheckoutRequest,
) {
	if (request.operation === "check") {
		const available = await controller.isInStock(request);
		return {
			ok: true as const,
			decision: { operation: "check" as const, available },
		};
	}
	if (request.operation === "set" || request.operation === "adjust") {
		const item =
			request.operation === "set"
				? await controller.setStock(request)
				: await controller.adjustStock(request);
		if (!item) {
			return {
				ok: false as const,
				failure: {
					code: "INVENTORY_ITEM_NOT_FOUND" as const,
					message: "The inventory item is not tracked.",
				},
			};
		}
		return {
			ok: true as const,
			decision: {
				operation: request.operation,
				stock: {
					quantity: item.quantity,
					reserved: item.reserved,
					available: item.available,
				},
			},
		};
	}

	const result = await controller[request.operation](request);
	if (!result) {
		return {
			ok: false as const,
			failure: {
				code:
					request.operation === "reserve"
						? ("INSUFFICIENT_STOCK" as const)
						: ("INVENTORY_ITEM_NOT_FOUND" as const),
				message:
					request.operation === "reserve"
						? "Inventory could not reserve the requested quantity."
						: "The inventory item is not tracked.",
			},
		};
	}
	return { ok: true as const, decision: { operation: request.operation } };
}

export const inventoryCheckoutProvider = provideCapability(
	inventoryCheckoutCapability,
	async (ctx, request) =>
		handleInventoryCheckout(
			createInventoryController(ctx.data, ctx.events, ctx.transactions),
			request,
		),
);
