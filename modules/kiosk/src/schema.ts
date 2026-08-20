import type { ModuleSchema } from "@86d-app/core/types/schema";

export const kioskSchema = {
	kioskStation: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			location: { type: "string", required: false },
			isOnline: { type: "boolean", required: true, defaultValue: false },
			isActive: { type: "boolean", required: true, defaultValue: true },
			lastHeartbeat: { type: "date", required: false },
			currentSessionId: { type: "string", required: false },
			settings: { type: "json", required: true, defaultValue: {} },
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
	kioskSession: {
		fields: {
			id: { type: "string", required: true },
			stationId: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "active" },
			items: { type: "json", required: true, defaultValue: [] },
			subtotal: { type: "number", required: true, defaultValue: 0 },
			tax: { type: "number", required: true, defaultValue: 0 },
			tip: { type: "number", required: true, defaultValue: 0 },
			total: { type: "number", required: true, defaultValue: 0 },
			paymentMethod: { type: "string", required: false },
			paymentStatus: {
				type: "string",
				required: true,
				defaultValue: "pending",
			},
			startedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			completedAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
