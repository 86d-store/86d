import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const notificationsSchema = {
	notification: {
		fields: {
			id: { type: "string", required: true },
			customerId: { type: "string", required: true },
			type: { type: "string", required: true, defaultValue: "info" },
			channel: { type: "string", required: true, defaultValue: "in_app" },
			priority: { type: "string", required: true, defaultValue: "normal" },
			title: { type: "string", required: true },
			body: { type: "string", required: true },
			actionUrl: { type: "string", required: false },
			metadata: { type: "json", required: true, defaultValue: {} },
			read: { type: "boolean", required: true, defaultValue: false },
			readAt: { type: "date", required: false },
			deliveryExternalId: { type: "string", required: false },
			deliveryStatus: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	template: {
		fields: {
			id: { type: "string", required: true },
			slug: { type: "string", required: true },
			name: { type: "string", required: true },
			type: { type: "string", required: true, defaultValue: "info" },
			channel: { type: "string", required: true, defaultValue: "in_app" },
			priority: { type: "string", required: true, defaultValue: "normal" },
			titleTemplate: { type: "string", required: true },
			bodyTemplate: { type: "string", required: true },
			actionUrlTemplate: { type: "string", required: false },
			variables: { type: "json", required: true, defaultValue: [] },
			active: { type: "boolean", required: true, defaultValue: true },
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
	preference: {
		fields: {
			id: { type: "string", required: true },
			customerId: { type: "string", required: true },
			orderUpdates: { type: "boolean", required: true, defaultValue: true },
			promotions: { type: "boolean", required: true, defaultValue: true },
			shippingAlerts: { type: "boolean", required: true, defaultValue: true },
			accountAlerts: { type: "boolean", required: true, defaultValue: true },
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	notificationIntentLock: {
		fields: {
			id: { type: "string", required: true },
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	notificationIntent: {
		fields: {
			id: { type: "string", required: true },
			idempotencyKey: { type: "string", required: true, index: true },
			requestFingerprint: { type: "string", required: true },
			sourceEventId: { type: "string", required: true, index: true },
			sourceModule: { type: "string", required: true, index: true },
			templateKey: { type: "string", required: true },
			channel: { type: "string", required: true },
			recipient: { type: "string", required: true },
			deliveryMode: { type: "string", required: true },
			connectionId: { type: "string", required: false, index: true },
			payload: { type: "json", required: true, defaultValue: {} },
			status: {
				type: "string",
				required: true,
				defaultValue: "pending",
				index: true,
			},
			attempts: { type: "number", required: true, defaultValue: 0 },
			acceptedRecipientUnits: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			providerMessageId: { type: "string", required: false, index: true },
			lastError: { type: "string", required: false },
			acceptedAt: { type: "date", required: false },
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

export const notificationsTables = transcodeModuleSchema(notificationsSchema);
