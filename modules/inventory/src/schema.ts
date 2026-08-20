import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const inventorySchema = {
	inventoryItem: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			variantId: { type: "string", required: false },
			locationId: { type: "string", required: false },
			/** Total units on hand */
			quantity: { type: "number", required: true, defaultValue: 0 },
			/** Units reserved for pending orders */
			reserved: { type: "number", required: true, defaultValue: 0 },
			lowStockThreshold: { type: "number", required: false },
			allowBackorder: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	backInStockSubscription: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			variantId: { type: "string", required: false },
			email: { type: "string", required: true },
			customerId: { type: "string", required: false },
			/** Product name snapshot for display */
			productName: { type: "string", required: false },
			/** "active" or "notified" */
			status: { type: "string", required: true, defaultValue: "active" },
			subscribedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			notifiedAt: { type: "date", required: false },
		},
	},
	inventoryReservation: {
		fields: {
			id: { type: "string", required: true },
			checkoutId: { type: "string", required: true, index: true },
			lineId: { type: "string", required: true },
			productId: { type: "string", required: true, index: true },
			variantId: { type: "string", required: false },
			locationId: { type: "string", required: false, index: true },
			quantity: { type: "number", required: true },
			leaseExpiresAt: { type: "date", required: true, index: true },
			status: { type: "string", required: true, index: true },
			idempotencyKey: { type: "string", required: true },
			committedAt: { type: "date", required: false },
			releasedAt: { type: "date", required: false },
			expiredAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	inventoryReservationOperation: {
		fields: {
			id: { type: "string", required: true },
			reservationId: { type: "string", required: true, index: true },
			idempotencyKey: { type: "string", required: true, index: true },
			operation: { type: "string", required: true },
			requestSignature: { type: "string", required: true },
			result: { type: "json", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	/** A stable row used to serialize every transition for one checkout line. */
	inventoryReservationLock: {
		fields: {
			id: { type: "string", required: true },
		},
	},
} satisfies ModuleSchema;

export const inventoryTables = transcodeModuleSchema(inventorySchema);
