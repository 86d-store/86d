import { provideCapability } from "@86d-store/core/capabilities";
import { inventoryCheckoutV2Capability } from "@86d-store/core/inventory-reservation-capability";
import { executeInventoryReservation } from "./reservations";
export const inventoryCheckoutV2Provider = provideCapability(
	inventoryCheckoutV2Capability,
	(ctx, request) => executeInventoryReservation(ctx.transactions, request),
);
