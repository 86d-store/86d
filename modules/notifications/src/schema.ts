import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const notificationsNotificationShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string(),
	type: z.string().default("info"),
	channel: z.string().default("in_app"),
	priority: z.string().default("normal"),
	title: z.string(),
	body: z.string(),
	actionUrl: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	read: z.boolean().default(false),
	readAt: z.coerce.date().optional(),
	deliveryExternalId: z.string().optional(),
	deliveryStatus: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const notificationsTemplateShape = z.object({
	id: z.string().register(col, { pk: true }),
	slug: z.string(),
	name: z.string(),
	type: z.string().default("info"),
	channel: z.string().default("in_app"),
	priority: z.string().default("normal"),
	titleTemplate: z.string(),
	bodyTemplate: z.string(),
	actionUrlTemplate: z.string().optional(),
	variables: z.array(z.unknown()).default([]),
	active: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const notificationsPreferenceShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string(),
	orderUpdates: z.boolean().default(true),
	promotions: z.boolean().default(true),
	shippingAlerts: z.boolean().default(true),
	accountAlerts: z.boolean().default(true),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const notificationsNotificationIntentLockShape = z.object({
	id: z.string().register(col, { pk: true }),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const notificationsNotificationIntentShape = z.object({
	id: z.string().register(col, { pk: true }),
	idempotencyKey: z.string().register(col, { index: true }),
	requestFingerprint: z.string(),
	sourceEventId: z.string().register(col, { index: true }),
	sourceModule: z.string().register(col, { index: true }),
	templateKey: z.string(),
	channel: z.string(),
	recipient: z.string(),
	deliveryMode: z.string(),
	connectionId: z.string().register(col, { index: true }).optional(),
	payload: z.record(z.string(), z.unknown()).default({}),
	status: z.string().register(col, { index: true }).default("pending"),
	attempts: z.int().default(0),
	acceptedRecipientUnits: z.int().default(0),
	providerMessageId: z.string().register(col, { index: true }).optional(),
	lastError: z.string().optional(),
	acceptedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for notifications. */
export const notificationsStorage = {
	kind: "relational",
	tables: {
		notification: {
			shape: notificationsNotificationShape,
		},
		template: {
			shape: notificationsTemplateShape,
		},
		preference: {
			shape: notificationsPreferenceShape,
		},
		notificationIntentLock: {
			shape: notificationsNotificationIntentLockShape,
		},
		notificationIntent: {
			shape: notificationsNotificationIntentShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
