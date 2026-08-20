import { z } from "zod";
import { defineCapability } from "./capabilities";

const identifier = z.string().min(1).max(200);

const reservationScope = {
	checkoutId: identifier,
	lineId: identifier,
};

const reservationView = z
	.object({
		id: z.string().min(1).max(255),
		checkoutId: identifier,
		lineId: identifier,
		productId: identifier,
		variantId: identifier.optional(),
		locationId: identifier.optional(),
		quantity: z.number().int().positive().max(1_000_000),
		leaseExpiresAt: z.string().datetime({ offset: true }),
		status: z.enum(["reserved", "committed", "released", "expired"]),
	})
	.strict();

/**
 * Inventory-owned checkout reservation contract.
 *
 * Version 1 lacks checkout and line identities, lease expiry, and operation
 * idempotency. Version 2 is intentionally additive so Checkout can migrate
 * without changing or activating the existing live path.
 */
export const inventoryCheckoutV2Capability = defineCapability({
	name: "inventory.checkout",
	version: "2.0.0",
	owner: "inventory",
	request: z.discriminatedUnion("operation", [
		z
			.object({
				operation: z.literal("reserve"),
				...reservationScope,
				productId: identifier,
				variantId: identifier.optional(),
				locationId: identifier.optional(),
				quantity: z.number().int().positive().max(1_000_000),
				leaseDurationSeconds: z.number().int().min(30).max(86_400),
				idempotencyKey: identifier,
			})
			.strict()
			.superRefine((request, context) => {
				const inventoryItemId = [
					request.productId,
					request.variantId ?? "_",
					request.locationId ?? "_",
				].join(":");
				if (inventoryItemId.length > 255) {
					context.addIssue({
						code: "custom",
						message: "The combined inventory item identity is too long.",
						path: ["productId"],
					});
				}
			}),
		z
			.object({
				operation: z.literal("commit"),
				...reservationScope,
				idempotencyKey: identifier,
			})
			.strict(),
		z
			.object({
				operation: z.literal("release"),
				...reservationScope,
				idempotencyKey: identifier,
			})
			.strict(),
		z
			.object({
				operation: z.literal("expire"),
				...reservationScope,
				idempotencyKey: identifier,
			})
			.strict(),
	]),
	decision: z
		.object({
			operation: z.enum(["reserve", "commit", "release", "expire"]),
			reservation: reservationView,
		})
		.strict(),
	failure: z
		.object({
			code: z.enum([
				"INSUFFICIENT_STOCK",
				"INVENTORY_ITEM_NOT_FOUND",
				"INVENTORY_STATE_INVALID",
				"RESERVATION_NOT_FOUND",
				"RESERVATION_CONFLICT",
				"RESERVATION_NOT_ACTIVE",
				"RESERVATION_EXPIRED",
				"LEASE_ACTIVE",
				"IDEMPOTENCY_KEY_REUSED",
				"TRANSACTION_UNAVAILABLE",
			]),
			message: z.string().min(1).max(200),
		})
		.strict(),
});
