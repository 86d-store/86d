import { provideCapability } from "@86d-app/core/capabilities";
import { inventoryCheckoutV2Capability } from "@86d-app/core/inventory-reservation-capability";
import { executeInventoryReservation } from "./reservations";

export { inventoryCheckoutV2Capability };

export const inventoryCheckoutV2Provider = provideCapability(
	inventoryCheckoutV2Capability,
	(ctx, request) => executeInventoryReservation(ctx.transactions, request),
);
