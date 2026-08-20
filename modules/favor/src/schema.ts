import type { ModuleSchema } from "@86d-app/core/types/schema";

export const favorSchema = {
	delivery: {
		fields: {
			id: { type: "string", required: true },
			orderId: { type: "string", required: true },
			externalId: { type: "string", required: false },
			/** pending | assigned | en-route | arrived | completed | cancelled */
			status: { type: "string", required: true },
			pickupAddress: { type: "json", required: true },
			dropoffAddress: { type: "json", required: true },
			estimatedArrival: { type: "date", required: false },
			actualArrival: { type: "date", required: false },
			fee: { type: "number", required: true },
			tip: { type: "number", required: true },
			runnerName: { type: "string", required: false },
			runnerPhone: { type: "string", required: false },
			trackingUrl: { type: "string", required: false },
			specialInstructions: { type: "string", required: false },
			metadata: { type: "json", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	serviceArea: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			isActive: { type: "boolean", required: true },
			zipCodes: { type: "json", required: true },
			minOrderAmount: { type: "number", required: true },
			deliveryFee: { type: "number", required: true },
			estimatedMinutes: { type: "number", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
