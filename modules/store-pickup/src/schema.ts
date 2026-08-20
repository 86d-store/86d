import type { ModuleSchema } from "@86d-app/core/types/schema";

export const storePickupSchema = {
	pickupLocation: {
		fields: {
			id: { type: "string", required: true },
			/** Display name (e.g. "Downtown Flagship Store") */
			name: { type: "string", required: true },
			/** Street address line 1 */
			address: { type: "string", required: true },
			/** City */
			city: { type: "string", required: true },
			/** State / province / region */
			state: { type: "string", required: true },
			/** ZIP / postal code */
			postalCode: { type: "string", required: true },
			/** ISO 3166-1 alpha-2 country code */
			country: { type: "string", required: true },
			/** Contact phone number */
			phone: { type: "string", required: false },
			/** Contact email */
			email: { type: "string", required: false },
			/** Latitude for map display */
			latitude: { type: "number", required: false },
			/** Longitude for map display */
			longitude: { type: "number", required: false },
			/** Minutes needed to prepare an order for pickup */
			preparationMinutes: {
				type: "number",
				required: true,
				defaultValue: 60,
			},
			/** Whether this location accepts new pickups */
			active: { type: "boolean", required: true, defaultValue: true },
			/** Display order */
			sortOrder: { type: "number", required: true, defaultValue: 0 },
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
	pickupWindow: {
		fields: {
			id: { type: "string", required: true },
			/** Parent location */
			locationId: {
				type: "string",
				required: true,
				references: {
					model: "pickupLocation",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** Day of week: 0 = Sunday … 6 = Saturday */
			dayOfWeek: { type: "number", required: true },
			/** Start time in HH:MM 24-hour format */
			startTime: { type: "string", required: true },
			/** End time in HH:MM 24-hour format */
			endTime: { type: "string", required: true },
			/** Maximum simultaneous pickups in this window */
			capacity: { type: "number", required: true },
			/** Whether this window is bookable */
			active: { type: "boolean", required: true, defaultValue: true },
			/** Display order within the same location/day */
			sortOrder: { type: "number", required: true, defaultValue: 0 },
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
	pickupOrder: {
		fields: {
			id: { type: "string", required: true },
			/** Location where pickup will happen */
			locationId: {
				type: "string",
				required: true,
				references: {
					model: "pickupLocation",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** Window used to schedule this pickup */
			windowId: {
				type: "string",
				required: true,
				references: {
					model: "pickupWindow",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** Associated commerce order */
			orderId: { type: "string", required: true, index: true },
			/** Customer who placed the order */
			customerId: { type: "string", required: false, index: true },
			/** Scheduled pickup date (YYYY-MM-DD) */
			scheduledDate: { type: "string", required: true, index: true },
			/** Denormalized location name */
			locationName: { type: "string", required: true },
			/** Denormalized location address */
			locationAddress: { type: "string", required: true },
			/** Denormalized window start time */
			startTime: { type: "string", required: true },
			/** Denormalized window end time */
			endTime: { type: "string", required: true },
			/** Pickup lifecycle status */
			status: {
				type: [
					"scheduled",
					"preparing",
					"ready",
					"picked_up",
					"cancelled",
				] as const,
				required: true,
			},
			/** Optional customer notes */
			notes: { type: "string", required: false },
			/** When preparation started */
			preparingAt: { type: "date", required: false },
			/** When order was marked ready */
			readyAt: { type: "date", required: false },
			/** When customer picked up */
			pickedUpAt: { type: "date", required: false },
			/** When pickup was cancelled */
			cancelledAt: { type: "date", required: false },
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
	pickupBlackout: {
		fields: {
			id: { type: "string", required: true },
			/** Location this blackout applies to */
			locationId: {
				type: "string",
				required: true,
				references: {
					model: "pickupLocation",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** Date to block (YYYY-MM-DD) */
			date: { type: "string", required: true, index: true },
			/** Reason displayed to staff */
			reason: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
