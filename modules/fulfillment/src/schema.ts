import type { ModuleSchema } from "@86d-app/core/types/schema";

export const fulfillmentSchema = {
	/** One stable owner-local row per Order used to serialize allocations. */
	fulfillmentOrderLock: {
		fields: {
			id: { type: "string", required: true },
			orderId: { type: "string", required: true, unique: true },
		},
	},
	fulfillment: {
		fields: {
			id: { type: "string", required: true },
			orderId: { type: "string", required: true },
			/** pending | processing | shipped | delivered | cancelled */
			status: { type: "string", required: true, defaultValue: "pending" },
			/** JSON array of { lineItemId, quantity } */
			items: { type: "json", required: true, defaultValue: [] },
			/** Carrier name (e.g. UPS, FedEx, USPS, DHL) */
			carrier: { type: "string", required: false },
			/** Carrier tracking number */
			trackingNumber: { type: "string", required: false },
			/** Tracking URL */
			trackingUrl: { type: "string", required: false },
			/** Internal notes for admin staff */
			notes: { type: "string", required: false },
			/** Timestamp when items were shipped */
			shippedAt: { type: "date", required: false },
			/** Timestamp when delivery was confirmed */
			deliveredAt: { type: "date", required: false },
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
} satisfies ModuleSchema;
