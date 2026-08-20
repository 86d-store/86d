import type { ModuleController } from "@86d-app/core/types/module";

export type NotificationType =
	| "info"
	| "success"
	| "warning"
	| "error"
	| "order"
	| "shipping"
	| "promotion";

export type NotificationChannel = "in_app" | "email" | "both";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type DeliveryStatus =
	| "pending"
	| "sent"
	| "delivered"
	| "failed"
	| "bounced"
	| "complained";

export type Notification = {
	id: string;
	customerId: string;
	type: NotificationType;
	channel: NotificationChannel;
	priority: NotificationPriority;
	title: string;
	body: string;
	actionUrl?: string | undefined;
	metadata: Record<string, unknown>;
	read: boolean;
	readAt?: Date | undefined;
	/** External message ID from Resend or Twilio — used for delivery status webhook lookup */
	deliveryExternalId?: string | undefined;
	/** Delivery status set by inbound webhooks from Resend or Twilio */
	deliveryStatus?: DeliveryStatus | undefined;
	createdAt: Date;
};

export type NotificationTemplate = {
	id: string;
	slug: string;
	name: string;
	type: NotificationType;
	channel: NotificationChannel;
	priority: NotificationPriority;
	titleTemplate: string;
	bodyTemplate: string;
	actionUrlTemplate?: string | undefined;
	/** Variable names expected by this template (e.g. ["orderNumber", "trackingUrl"]) */
	variables: string[];
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type NotificationPreference = {
	id: string;
	customerId: string;
	orderUpdates: boolean;
	promotions: boolean;
	shippingAlerts: boolean;
	accountAlerts: boolean;
	updatedAt: Date;
};

export type NotificationStats = {
	total: number;
	unread: number;
	byType: Record<string, number>;
	byPriority: Record<string, number>;
};

export type BatchSendResult = {
	sent: number;
	failed: number;
	errors: Array<{ customerId: string; error: string }>;
};

export type NotificationsController = ModuleController & {
	create(params: {
		customerId: string;
		type?: NotificationType | undefined;
		channel?: NotificationChannel | undefined;
		priority?: NotificationPriority | undefined;
		title: string;
		body: string;
		actionUrl?: string | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<Notification>;

	get(id: string): Promise<Notification | null>;

	update(
		id: string,
		params: {
			title?: string | undefined;
			body?: string | undefined;
			actionUrl?: string | undefined;
			metadata?: Record<string, unknown> | undefined;
		},
	): Promise<Notification | null>;

	delete(id: string): Promise<boolean>;

	list(params?: {
		customerId?: string | undefined;
		type?: NotificationType | undefined;
		read?: boolean | undefined;
		priority?: NotificationPriority | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Notification[]>;

	markRead(id: string): Promise<Notification | null>;

	markAllRead(customerId: string): Promise<number>;

	unreadCount(customerId: string): Promise<number>;

	getStats(): Promise<NotificationStats>;

	bulkDelete(ids: string[]): Promise<number>;

	getPreferences(customerId: string): Promise<NotificationPreference>;

	updatePreferences(
		customerId: string,
		params: {
			orderUpdates?: boolean | undefined;
			promotions?: boolean | undefined;
			shippingAlerts?: boolean | undefined;
			accountAlerts?: boolean | undefined;
		},
	): Promise<NotificationPreference>;

	deletePreferences(customerId: string): Promise<boolean>;

	listPreferences(params?: {
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<NotificationPreference[]>;

	// --- Template methods ---

	createTemplate(params: {
		slug: string;
		name: string;
		type?: NotificationType | undefined;
		channel?: NotificationChannel | undefined;
		priority?: NotificationPriority | undefined;
		titleTemplate: string;
		bodyTemplate: string;
		actionUrlTemplate?: string | undefined;
		variables?: string[] | undefined;
	}): Promise<NotificationTemplate>;

	getTemplate(id: string): Promise<NotificationTemplate | null>;

	getTemplateBySlug(slug: string): Promise<NotificationTemplate | null>;

	updateTemplate(
		id: string,
		params: {
			name?: string | undefined;
			type?: NotificationType | undefined;
			channel?: NotificationChannel | undefined;
			priority?: NotificationPriority | undefined;
			titleTemplate?: string | undefined;
			bodyTemplate?: string | undefined;
			actionUrlTemplate?: string | undefined;
			variables?: string[] | undefined;
			active?: boolean | undefined;
		},
	): Promise<NotificationTemplate | null>;

	deleteTemplate(id: string): Promise<boolean>;

	listTemplates(params?: {
		active?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<NotificationTemplate[]>;

	// --- Batch + template-based send ---

	sendFromTemplate(params: {
		templateId: string;
		customerIds: string[];
		variables?: Record<string, string> | undefined;
	}): Promise<BatchSendResult>;

	batchSend(params: {
		customerIds: string[];
		type?: NotificationType | undefined;
		channel?: NotificationChannel | undefined;
		priority?: NotificationPriority | undefined;
		title: string;
		body: string;
		actionUrl?: string | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<BatchSendResult>;

	// --- Delivery status webhook helpers ---

	findByExternalId(externalId: string): Promise<Notification | null>;

	updateDeliveryStatus(
		id: string,
		status: DeliveryStatus,
	): Promise<Notification | null>;
};
