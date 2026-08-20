import type { ModuleSchema } from "@86d-app/core/types/schema";

export const uberDirectSchema = {
	delivery: {
		fields: {
			id: { type: "string", required: true },
			orderId: { type: "string", required: true },
			externalId: { type: "string", required: false },
			/** pending | quoted | accepted | picked-up | delivered | cancelled | failed */
			status: { type: "string", required: true },
			pickupAddress: { type: "json", required: true },
			dropoffAddress: { type: "json", required: true },
			pickupNotes: { type: "string", required: false },
			dropoffNotes: { type: "string", required: false },
			estimatedPickupTime: { type: "date", required: false },
			estimatedDeliveryTime: { type: "date", required: false },
			actualPickupTime: { type: "date", required: false },
			actualDeliveryTime: { type: "date", required: false },
			fee: { type: "number", required: true },
			tip: { type: "number", required: true },
			trackingUrl: { type: "string", required: false },
			courierName: { type: "string", required: false },
			courierPhone: { type: "string", required: false },
			courierVehicle: { type: "string", required: false },
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
	quote: {
		fields: {
			id: { type: "string", required: true },
			pickupAddress: { type: "json", required: true },
			dropoffAddress: { type: "json", required: true },
			fee: { type: "number", required: true },
			estimatedMinutes: { type: "number", required: true },
			expiresAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			/** active | expired | used */
			status: { type: "string", required: true },
			createdAt: {
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
			isActive: { type: "boolean", required: true, defaultValue: true },
			radius: { type: "number", required: true },
			centerLat: { type: "number", required: true },
			centerLng: { type: "number", required: true },
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
				onUpdate: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
