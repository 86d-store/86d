import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	DeliveryResult,
	ResendProvider,
	TwilioProvider,
} from "./provider";
import type {
	BatchSendResult,
	DeliveryStatus,
	Notification,
	NotificationPreference,
	NotificationStats,
	NotificationsController,
	NotificationTemplate,
} from "./service";

const DEFAULT_PREFERENCES: Omit<NotificationPreference, "id" | "customerId"> = {
	orderUpdates: true,
	promotions: true,
	shippingAlerts: true,
	accountAlerts: true,
	updatedAt: new Date(),
};

export interface NotificationsControllerOptions {
	/** Max notifications per customer before oldest are auto-deleted */
	maxPerCustomer?: number | undefined;
	/** Resend email provider — when provided, email channel notifications are delivered via Resend */
	emailProvider?: ResendProvider | undefined;
	/** Twilio SMS provider — when provided, notifications can resolve a phone number from metadata */
	smsProvider?: TwilioProvider | undefined;
	/** Resolver that returns email + phone for a customer ID. Required for email/SMS delivery. */
	customerResolver?:
		| ((customerId: string) => Promise<{
				email?: string | undefined;
				phone?: string | undefined;
		  }>)
		| undefined;
	/** Full URL that Twilio should POST delivery status updates to (e.g. https://store.com/notifications/webhook/twilio) */
	twilioStatusCallbackUrl?: string | undefined;
}

/** Minimal HTML-entity escape for user-facing strings injected into email HTML. */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Interpolate `{{variable}}` placeholders in a template string.
 * Unknown variables are left as-is.
 */
function interpolate(
	template: string,
	variables: Record<string, string>,
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
		key in variables ? variables[key] : `{{${key}}}`,
	);
}

function runInBackground(task: Promise<unknown>, label: string) {
	void task.catch((error: unknown) => {
		console.error(`[notifications] ${label} failed`, error);
	});
}

export function createNotificationsController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: NotificationsControllerOptions | undefined,
): NotificationsController {
	const emailProvider = options?.emailProvider;
	const smsProvider = options?.smsProvider;
	const customerResolver = options?.customerResolver;
	const twilioStatusCallbackUrl = options?.twilioStatusCallbackUrl;

	/**
	 * Deliver a notification via the appropriate external channel.
	 * Falls back gracefully if providers or customer contact info are unavailable.
	 */
	async function deliverExternal(
		notification: Notification,
	): Promise<DeliveryResult | null> {
		const channel = notification.channel;
		if (channel === "in_app") return null;

		if (!customerResolver) return null;

		const contact = await customerResolver(notification.customerId).catch(
			() => ({ email: undefined, phone: undefined }),
		);

		if (
			(channel === "email" || channel === "both") &&
			emailProvider &&
			contact.email
		) {
			const htmlBody = `<div><h2>${escapeHtml(notification.title)}</h2><p>${escapeHtml(notification.body)}</p>${
				notification.actionUrl
					? `<p><a href="${escapeHtml(notification.actionUrl)}">View details</a></p>`
					: ""
			}</div>`;

			const result = await emailProvider
				.sendEmail({
					to: contact.email,
					subject: notification.title,
					html: htmlBody,
					text: `${notification.title}\n\n${notification.body}${notification.actionUrl ? `\n\n${notification.actionUrl}` : ""}`,
					tags: [
						{ name: "type", value: notification.type },
						{ name: "notification_id", value: notification.id },
					],
				})
				.catch(
					(err: Error): DeliveryResult => ({
						success: false,
						error: err.message,
					}),
				);

			// Record delivery attempt — store external ID for webhook lookup
			await data.upsert("notification", notification.id, {
				...notification,
				deliveryExternalId: result.messageId ?? null,
				deliveryStatus: result.success
					? ("sent" satisfies DeliveryStatus)
					: ("failed" satisfies DeliveryStatus),
				metadata: {
					...notification.metadata,
					emailDelivery: {
						success: result.success,
						messageId: result.messageId,
						error: result.error,
						sentAt: new Date().toISOString(),
					},
				},
			} as Record<string, unknown>);

			if (channel === "email") return result;
		}

		if (channel === "both" && smsProvider && contact.phone) {
			const smsText = `${notification.title}: ${notification.body}`;
			const result = await smsProvider
				.sendSms({
					to: contact.phone,
					body:
						smsText.length > 1600 ? `${smsText.slice(0, 1597)}...` : smsText,
					statusCallback: twilioStatusCallbackUrl,
				})
				.catch(
					(err: Error): DeliveryResult => ({
						success: false,
						error: err.message,
					}),
				);

			// Store external ID for Twilio StatusCallback webhook lookup
			await data.upsert("notification", notification.id, {
				...notification,
				deliveryExternalId: result.messageId ?? null,
				deliveryStatus: result.success
					? ("sent" satisfies DeliveryStatus)
					: ("failed" satisfies DeliveryStatus),
				metadata: {
					...notification.metadata,
					smsDelivery: {
						success: result.success,
						messageId: result.messageId,
						error: result.error,
						sentAt: new Date().toISOString(),
					},
				},
			} as Record<string, unknown>);

			return result;
		}

		return null;
	}

	/** Remove oldest notifications when a customer exceeds maxPerCustomer */
	async function enforceMaxPerCustomer(customerId: string): Promise<void> {
		const max = options?.maxPerCustomer;
		if (!max) return;

		const all = (await data.findMany("notification", {
			where: { customerId },
		})) as unknown as Notification[];

		if (all.length <= max) return;

		// Sort oldest-first
		const sorted = [...all].sort(
			(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
		);
		const toRemove = sorted.slice(0, all.length - max);
		for (const n of toRemove) {
			await data.delete("notification", n.id);
		}
	}

	return {
		async create(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const notification: Notification = {
				id,
				customerId: params.customerId,
				type: params.type ?? "info",
				channel: params.channel ?? "in_app",
				priority: params.priority ?? "normal",
				title: params.title,
				body: params.body,
				actionUrl: params.actionUrl,
				metadata: params.metadata ?? {},
				read: false,
				createdAt: now,
			};
			await data.upsert(
				"notification",
				id,
				notification as Record<string, unknown>,
			);

			await enforceMaxPerCustomer(params.customerId);

			// Dispatch external delivery (email/SMS) — fire and forget
			runInBackground(
				deliverExternal(notification),
				`external delivery for notification ${id}`,
			);

			if (events) {
				runInBackground(
					events.emit("notifications.created", {
						notificationId: id,
						customerId: params.customerId,
						type: notification.type,
						priority: notification.priority,
					}),
					`notifications.created emit for ${id}`,
				);
			}

			return notification;
		},

		async get(id) {
			const raw = await data.get("notification", id);
			if (!raw) return null;
			return raw as unknown as Notification;
		},

		async update(id, params) {
			const existing = await data.get("notification", id);
			if (!existing) return null;

			const notification = existing as unknown as Notification;
			const updated: Notification = {
				...notification,
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.body !== undefined ? { body: params.body } : {}),
				...(params.actionUrl !== undefined
					? { actionUrl: params.actionUrl }
					: {}),
				...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
			};
			await data.upsert("notification", id, updated as Record<string, unknown>);
			return updated;
		},

		async delete(id) {
			const existing = await data.get("notification", id);
			if (!existing) return false;
			await data.delete("notification", id);
			return true;
		},

		async list(params) {
			const where: Record<string, unknown> = {};
			if (params?.customerId) where.customerId = params.customerId;
			if (params?.type) where.type = params.type;
			if (params?.read !== undefined) where.read = params.read;
			if (params?.priority) where.priority = params.priority;

			const all = await data.findMany("notification", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as Notification[];
		},

		async markRead(id) {
			const existing = await data.get("notification", id);
			if (!existing) return null;

			const notification = existing as unknown as Notification;
			if (notification.read) return notification;

			const now = new Date();
			const updated: Notification = {
				...notification,
				read: true,
				readAt: now,
			};
			await data.upsert("notification", id, updated as Record<string, unknown>);

			if (events) {
				runInBackground(
					events.emit("notifications.read", {
						notificationId: id,
						customerId: notification.customerId,
					}),
					`notifications.read emit for ${id}`,
				);
			}

			return updated;
		},

		async markAllRead(customerId) {
			const unread = await data.findMany("notification", {
				where: { customerId, read: false },
			});
			const notifications = unread as unknown as Notification[];
			const now = new Date();
			let count = 0;

			for (const n of notifications) {
				const updated: Notification = { ...n, read: true, readAt: now };
				await data.upsert(
					"notification",
					n.id,
					updated as Record<string, unknown>,
				);
				count++;
			}

			if (events && count > 0) {
				runInBackground(
					events.emit("notifications.all_read", {
						customerId,
						count,
					}),
					`notifications.all_read emit for ${customerId}`,
				);
			}

			return count;
		},

		async unreadCount(customerId) {
			const unread = await data.findMany("notification", {
				where: { customerId, read: false },
			});
			return unread.length;
		},

		async getStats() {
			const all = await data.findMany("notification", {});
			const notifications = all as unknown as Notification[];

			const stats: NotificationStats = {
				total: notifications.length,
				unread: 0,
				byType: {},
				byPriority: {},
			};

			for (const n of notifications) {
				if (!n.read) stats.unread++;
				stats.byType[n.type] = (stats.byType[n.type] ?? 0) + 1;
				stats.byPriority[n.priority] = (stats.byPriority[n.priority] ?? 0) + 1;
			}

			return stats;
		},

		async bulkDelete(ids) {
			let count = 0;
			for (const id of ids) {
				const existing = await data.get("notification", id);
				if (existing) {
					await data.delete("notification", id);
					count++;
				}
			}
			return count;
		},

		async getPreferences(customerId) {
			const matches = await data.findMany("preference", {
				where: { customerId },
				take: 1,
			});
			const existing = matches[0] as unknown as
				| NotificationPreference
				| undefined;

			if (existing) return existing;

			// Return defaults without persisting — creates on first update
			const id = crypto.randomUUID();
			return {
				id,
				customerId,
				...DEFAULT_PREFERENCES,
				updatedAt: new Date(),
			};
		},

		async updatePreferences(customerId, params) {
			const matches = await data.findMany("preference", {
				where: { customerId },
				take: 1,
			});
			const existing = matches[0] as unknown as
				| NotificationPreference
				| undefined;

			const now = new Date();
			const id = existing?.id ?? crypto.randomUUID();
			const updated: NotificationPreference = {
				id,
				customerId,
				orderUpdates: params.orderUpdates ?? existing?.orderUpdates ?? true,
				promotions: params.promotions ?? existing?.promotions ?? true,
				shippingAlerts:
					params.shippingAlerts ?? existing?.shippingAlerts ?? true,
				accountAlerts: params.accountAlerts ?? existing?.accountAlerts ?? true,
				updatedAt: now,
			};
			await data.upsert("preference", id, updated as Record<string, unknown>);
			return updated;
		},

		async deletePreferences(customerId) {
			const matches = await data.findMany("preference", {
				where: { customerId },
				take: 1,
			});
			const existing = matches[0] as unknown as
				| NotificationPreference
				| undefined;
			if (!existing) return false;
			await data.delete("preference", existing.id);
			return true;
		},

		async listPreferences(params) {
			const all = await data.findMany("preference", {
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as NotificationPreference[];
		},

		// --- Template CRUD ---

		async createTemplate(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const template: NotificationTemplate = {
				id,
				slug: params.slug,
				name: params.name,
				type: params.type ?? "info",
				channel: params.channel ?? "in_app",
				priority: params.priority ?? "normal",
				titleTemplate: params.titleTemplate,
				bodyTemplate: params.bodyTemplate,
				actionUrlTemplate: params.actionUrlTemplate,
				variables: params.variables ?? [],
				active: true,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("template", id, template as Record<string, unknown>);
			return template;
		},

		async getTemplate(id) {
			const raw = await data.get("template", id);
			if (!raw) return null;
			return raw as unknown as NotificationTemplate;
		},

		async getTemplateBySlug(slug) {
			const matches = await data.findMany("template", {
				where: { slug },
				take: 1,
			});
			const found = matches[0] as unknown as NotificationTemplate | undefined;
			return found ?? null;
		},

		async updateTemplate(id, params) {
			const existing = await data.get("template", id);
			if (!existing) return null;

			const template = existing as unknown as NotificationTemplate;
			const now = new Date();
			const updated: NotificationTemplate = {
				...template,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.type !== undefined ? { type: params.type } : {}),
				...(params.channel !== undefined ? { channel: params.channel } : {}),
				...(params.priority !== undefined ? { priority: params.priority } : {}),
				...(params.titleTemplate !== undefined
					? { titleTemplate: params.titleTemplate }
					: {}),
				...(params.bodyTemplate !== undefined
					? { bodyTemplate: params.bodyTemplate }
					: {}),
				...(params.actionUrlTemplate !== undefined
					? { actionUrlTemplate: params.actionUrlTemplate }
					: {}),
				...(params.variables !== undefined
					? { variables: params.variables }
					: {}),
				...(params.active !== undefined ? { active: params.active } : {}),
				updatedAt: now,
			};
			await data.upsert("template", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteTemplate(id) {
			const existing = await data.get("template", id);
			if (!existing) return false;
			await data.delete("template", id);
			return true;
		},

		async listTemplates(params) {
			const where: Record<string, unknown> = {};
			if (params?.active !== undefined) where.active = params.active;

			const all = await data.findMany("template", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as NotificationTemplate[];
		},

		// --- Batch + template-based send ---

		async sendFromTemplate(params) {
			const template = await data.get("template", params.templateId);
			if (!template) {
				return {
					sent: 0,
					failed: params.customerIds.length,
					errors: params.customerIds.map((customerId) => ({
						customerId,
						error: "Template not found",
					})),
				};
			}

			const tpl = template as unknown as NotificationTemplate;
			if (!tpl.active) {
				return {
					sent: 0,
					failed: params.customerIds.length,
					errors: params.customerIds.map((customerId) => ({
						customerId,
						error: "Template is inactive",
					})),
				};
			}

			const vars = params.variables ?? {};
			const title = interpolate(tpl.titleTemplate, vars);
			const body = interpolate(tpl.bodyTemplate, vars);
			const actionUrl = tpl.actionUrlTemplate
				? interpolate(tpl.actionUrlTemplate, vars)
				: undefined;

			const result: BatchSendResult = { sent: 0, failed: 0, errors: [] };

			for (const customerId of params.customerIds) {
				try {
					const id = crypto.randomUUID();
					const now = new Date();
					const notification: Notification = {
						id,
						customerId,
						type: tpl.type,
						channel: tpl.channel,
						priority: tpl.priority,
						title,
						body,
						actionUrl,
						metadata: { templateId: tpl.id, templateSlug: tpl.slug },
						read: false,
						createdAt: now,
					};
					await data.upsert(
						"notification",
						id,
						notification as Record<string, unknown>,
					);
					void deliverExternal(notification);
					result.sent++;
				} catch (err) {
					result.failed++;
					result.errors.push({
						customerId,
						error: err instanceof Error ? err.message : String(err),
					});
				}
			}

			return result;
		},

		async batchSend(params) {
			const result: BatchSendResult = { sent: 0, failed: 0, errors: [] };

			for (const customerId of params.customerIds) {
				try {
					const id = crypto.randomUUID();
					const now = new Date();
					const notification: Notification = {
						id,
						customerId,
						type: params.type ?? "info",
						channel: params.channel ?? "in_app",
						priority: params.priority ?? "normal",
						title: params.title,
						body: params.body,
						actionUrl: params.actionUrl,
						metadata: params.metadata ?? {},
						read: false,
						createdAt: now,
					};
					await data.upsert(
						"notification",
						id,
						notification as Record<string, unknown>,
					);
					void deliverExternal(notification);
					result.sent++;
				} catch (err) {
					result.failed++;
					result.errors.push({
						customerId,
						error: err instanceof Error ? err.message : String(err),
					});
				}
			}

			return result;
		},

		async findByExternalId(externalId) {
			const results = (await data.findMany("notification", {
				where: { deliveryExternalId: externalId },
				take: 1,
			})) as unknown as Notification[];
			return results[0] ?? null;
		},

		async updateDeliveryStatus(id, status) {
			const existing = (await data.get(
				"notification",
				id,
			)) as unknown as Notification | null;
			if (!existing) return null;
			await data.upsert("notification", id, {
				...existing,
				deliveryStatus: status,
			} as Record<string, unknown>);
			return { ...existing, deliveryStatus: status };
		},
	};
}
