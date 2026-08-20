import type { ModuleSchema } from "@86d-app/core/types/schema";

export const doordashSchema = {
	delivery: {
		fields: {
			id: { type: "string", required: true },
			orderId: { type: "string", required: true },
			externalDeliveryId: { type: "string", required: false },
			status: { type: "string", required: true, defaultValue: "pending" },
			pickupAddress: { type: "json", required: true, defaultValue: {} },
			dropoffAddress: { type: "json", required: true, defaultValue: {} },
			estimatedPickupTime: { type: "date", required: false },
			estimatedDeliveryTime: { type: "date", required: false },
			actualPickupTime: { type: "date", required: false },
			actualDeliveryTime: { type: "date", required: false },
			fee: { type: "number", required: true },
			tip: { type: "number", required: true, defaultValue: 0 },
			trackingUrl: { type: "string", required: false },
			driverName: { type: "string", required: false },
			driverPhone: { type: "string", required: false },
			metadata: { type: "json", required: true, defaultValue: {} },
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
	quote: {
		fields: {
			id: { type: "string", required: true },
			externalDeliveryId: { type: "string", required: true },
			fee: { type: "number", required: true },
			currency: { type: "string", required: true, defaultValue: "USD" },
			estimatedPickupTime: { type: "string", required: false },
			estimatedDropoffTime: { type: "string", required: false },
			expiresAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	deliveryZone: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			isActive: { type: "boolean", required: true, defaultValue: true },
			radius: { type: "number", required: true },
			centerLat: { type: "number", required: true },
			centerLng: { type: "number", required: true },
			minOrderAmount: { type: "number", required: true, defaultValue: 0 },
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
