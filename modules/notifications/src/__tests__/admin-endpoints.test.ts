import { describe, expect, it, vi } from "vitest";
import { batchSendEndpoint } from "../admin/endpoints/batch-send";
import { bulkDeleteEndpoint } from "../admin/endpoints/bulk-delete";
import { createNotificationEndpoint } from "../admin/endpoints/create-notification";
import { createTemplateEndpoint } from "../admin/endpoints/create-template";
import { deleteCustomerPreferencesEndpoint } from "../admin/endpoints/delete-customer-preferences";
import { deleteNotificationEndpoint } from "../admin/endpoints/delete-notification";
import { deleteTemplateEndpoint } from "../admin/endpoints/delete-template";
import { getCustomerPreferencesEndpoint } from "../admin/endpoints/get-customer-preferences";
import { getNotificationEndpoint } from "../admin/endpoints/get-notification";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { getTemplateEndpoint } from "../admin/endpoints/get-template";
import { listNotificationsEndpoint } from "../admin/endpoints/list-notifications";
import { listPreferencesEndpoint } from "../admin/endpoints/list-preferences";
import { listTemplatesEndpoint } from "../admin/endpoints/list-templates";
import { sendFromTemplateEndpoint } from "../admin/endpoints/send-from-template";
import { statsEndpoint } from "../admin/endpoints/stats";
import { updateCustomerPreferencesEndpoint } from "../admin/endpoints/update-customer-preferences";
import { updateNotificationEndpoint } from "../admin/endpoints/update-notification";
import { updateTemplateEndpoint } from "../admin/endpoints/update-template";
import type {
	BatchSendResult,
	Notification,
	NotificationPreference,
	NotificationStats,
	NotificationsController,
	NotificationTemplate,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		customerId: "cust-1",
		type: "info",
		channel: "in_app",
		priority: "normal",
		title: "Hello",
		body: "You have a new notification",
		metadata: {},
		read: false,
		createdAt: now,
		...overrides,
	};
}

function makeTemplate(
	overrides: Partial<NotificationTemplate> = {},
): NotificationTemplate {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		slug: "welcome-email",
		name: "Welcome Email",
		type: "info",
		channel: "email",
		priority: "normal",
		titleTemplate: "Welcome, {{name}}!",
		bodyTemplate: "Thanks for signing up.",
		variables: ["name"],
		active: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makePreference(
	overrides: Partial<NotificationPreference> = {},
): NotificationPreference {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		customerId: "cust-1",
		orderUpdates: true,
		promotions: false,
		shippingAlerts: true,
		accountAlerts: true,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<NotificationsController> = {},
): NotificationsController {
	return {
		create: vi.fn().mockResolvedValue(makeNotification()),
		get: vi.fn().mockResolvedValue(null),
		update: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(false),
		list: vi.fn().mockResolvedValue([]),
		markRead: vi.fn().mockResolvedValue(null),
		markAllRead: vi.fn().mockResolvedValue(0),
		unreadCount: vi.fn().mockResolvedValue(0),
		getStats: vi.fn().mockResolvedValue({
			total: 0,
			unread: 0,
			byType: {},
			byPriority: {},
		} satisfies NotificationStats),
		bulkDelete: vi.fn().mockResolvedValue(0),
		getPreferences: vi.fn().mockResolvedValue(makePreference()),
		updatePreferences: vi.fn().mockResolvedValue(makePreference()),
		deletePreferences: vi.fn().mockResolvedValue(false),
		listPreferences: vi.fn().mockResolvedValue([]),
		createTemplate: vi.fn().mockResolvedValue(makeTemplate()),
		getTemplate: vi.fn().mockResolvedValue(null),
		getTemplateBySlug: vi.fn().mockResolvedValue(null),
		updateTemplate: vi.fn().mockResolvedValue(null),
		deleteTemplate: vi.fn().mockResolvedValue(false),
		listTemplates: vi.fn().mockResolvedValue([]),
		sendFromTemplate: vi.fn().mockResolvedValue({
			sent: 0,
			failed: 0,
			errors: [],
		} satisfies BatchSendResult),
		batchSend: vi.fn().mockResolvedValue({
			sent: 0,
			failed: 0,
			errors: [],
		} satisfies BatchSendResult),
		findByExternalId: vi.fn().mockResolvedValue(null),
		updateDeliveryStatus: vi.fn().mockResolvedValue(null),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: NotificationsController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { notifications: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listHandler = extractHandler(listNotificationsEndpoint);
const createNotificationHandler = extractHandler(createNotificationEndpoint);
const getNotificationHandler = extractHandler(getNotificationEndpoint);
const updateNotificationHandler = extractHandler(updateNotificationEndpoint);
const deleteNotificationHandler = extractHandler(deleteNotificationEndpoint);
const bulkDeleteHandler = extractHandler(bulkDeleteEndpoint);
const batchSendHandler = extractHandler(batchSendEndpoint);
const statsHandler = extractHandler(statsEndpoint);
const listPreferencesHandler = extractHandler(listPreferencesEndpoint);
const getCustomerPreferencesHandler = extractHandler(
	getCustomerPreferencesEndpoint,
);
const updateCustomerPreferencesHandler = extractHandler(
	updateCustomerPreferencesEndpoint,
);
const deleteCustomerPreferencesHandler = extractHandler(
	deleteCustomerPreferencesEndpoint,
);
const listTemplatesHandler = extractHandler(listTemplatesEndpoint);
const getTemplateHandler = extractHandler(getTemplateEndpoint);
const createTemplateHandler = extractHandler(createTemplateEndpoint);
const updateTemplateHandler = extractHandler(updateTemplateEndpoint);
const deleteTemplateHandler = extractHandler(deleteTemplateEndpoint);
const sendFromTemplateHandler = extractHandler(sendFromTemplateEndpoint);
const settingsHandler = extractHandler(createGetSettingsEndpoint({}));

// ── admin GET /notifications ──────────────────────────────────────────────────

describe("admin GET /notifications", () => {
	it("returns empty list when no notifications exist", async () => {
		const result = (await call(listHandler)) as {
			notifications: Notification[];
			total: number;
		};
		expect(result.notifications).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns notifications from controller", async () => {
		const notifications = [makeNotification(), makeNotification()];
		const ctrl = makeController({
			list: vi.fn().mockResolvedValue(notifications),
		});
		const result = (await call(listHandler, {
			controller: ctrl,
		})) as { notifications: Notification[]; total: number };
		expect(result.notifications).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("passes filters to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { customerId: "cust-99", type: "order", read: "false" },
			controller: ctrl,
		});
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({
				customerId: "cust-99",
				type: "order",
				read: false,
			}),
		);
	});
});

// ── admin POST /notifications/create ─────────────────────────────────────────

describe("admin POST /notifications/create", () => {
	it("creates a notification and returns it", async () => {
		const notification = makeNotification({
			customerId: "cust-2",
			type: "order",
			title: "Order placed",
		});
		const ctrl = makeController({
			create: vi.fn().mockResolvedValue(notification),
		});
		const result = (await call(createNotificationHandler, {
			body: {
				customerId: "cust-2",
				type: "order",
				title: "Order placed",
				body: "Your order has been placed.",
			},
			controller: ctrl,
		})) as { notification: Notification };
		expect(result.notification.type).toBe("order");
		expect(result.notification.title).toBe("Order placed");
		expect(ctrl.create).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cust-2", type: "order" }),
		);
	});

	it("forwards metadata to controller", async () => {
		const ctrl = makeController();
		await call(createNotificationHandler, {
			body: {
				customerId: "cust-3",
				title: "Info",
				body: "Some body text",
				metadata: { orderId: "ord-1" },
			},
			controller: ctrl,
		});
		expect(ctrl.create).toHaveBeenCalledWith(
			expect.objectContaining({ metadata: { orderId: "ord-1" } }),
		);
	});
});

// ── admin GET /notifications/:id ──────────────────────────────────────────────

describe("admin GET /notifications/:id", () => {
	it("returns error without status when notification not found", async () => {
		const result = (await call(getNotificationHandler, {
			params: { id: "nonexistent" },
		})) as { error: string };
		expect(result.error).toBe("Notification not found");
		expect((result as Record<string, unknown>).status).toBeUndefined();
	});

	it("returns notification when found", async () => {
		const notification = makeNotification({ id: "notif-1" });
		const ctrl = makeController({
			get: vi.fn().mockResolvedValue(notification),
		});
		const result = (await call(getNotificationHandler, {
			params: { id: "notif-1" },
			controller: ctrl,
		})) as { notification: Notification };
		expect(result.notification.id).toBe("notif-1");
		expect(ctrl.get).toHaveBeenCalledWith("notif-1");
	});
});

// ── admin POST /notifications/:id/update ─────────────────────────────────────

describe("admin POST /notifications/:id/update", () => {
	it("returns error without status when notification not found", async () => {
		const result = (await call(updateNotificationHandler, {
			params: { id: "missing" },
			body: { title: "New title" },
		})) as { error: string };
		expect(result.error).toBe("Notification not found");
		expect((result as Record<string, unknown>).status).toBeUndefined();
	});

	it("returns updated notification on success", async () => {
		const updated = makeNotification({ id: "notif-2", title: "Updated title" });
		const ctrl = makeController({
			update: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateNotificationHandler, {
			params: { id: "notif-2" },
			body: { title: "Updated title" },
			controller: ctrl,
		})) as { notification: Notification };
		expect(result.notification.title).toBe("Updated title");
		expect(ctrl.update).toHaveBeenCalledWith(
			"notif-2",
			expect.objectContaining({ title: "Updated title" }),
		);
	});
});

// ── admin POST /notifications/:id/delete ─────────────────────────────────────

describe("admin POST /notifications/:id/delete", () => {
	it("returns success: false when notification not found", async () => {
		const result = (await call(deleteNotificationHandler, {
			params: { id: "gone" },
		})) as { success: boolean };
		expect(result.success).toBe(false);
	});

	it("returns success: true when deleted", async () => {
		const ctrl = makeController({
			delete: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteNotificationHandler, {
			params: { id: "notif-3" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.delete).toHaveBeenCalledWith("notif-3");
	});
});

// ── admin POST /notifications/bulk-delete ────────────────────────────────────

describe("admin POST /notifications/bulk-delete", () => {
	it("returns count of deleted notifications", async () => {
		const ctrl = makeController({
			bulkDelete: vi.fn().mockResolvedValue(3),
		});
		const result = (await call(bulkDeleteHandler, {
			body: { ids: ["a", "b", "c"] },
			controller: ctrl,
		})) as { deleted: number };
		expect(result.deleted).toBe(3);
		expect(ctrl.bulkDelete).toHaveBeenCalledWith(["a", "b", "c"]);
	});

	it("returns 0 when no matching ids", async () => {
		const ctrl = makeController({
			bulkDelete: vi.fn().mockResolvedValue(0),
		});
		const result = (await call(bulkDeleteHandler, {
			body: { ids: ["nope"] },
			controller: ctrl,
		})) as { deleted: number };
		expect(result.deleted).toBe(0);
	});
});

// ── admin POST /notifications/batch-send ─────────────────────────────────────

describe("admin POST /notifications/batch-send", () => {
	it("returns BatchSendResult directly (not wrapped)", async () => {
		const batchResult: BatchSendResult = {
			sent: 2,
			failed: 1,
			errors: [{ customerId: "cust-bad", error: "Unsubscribed" }],
		};
		const ctrl = makeController({
			batchSend: vi.fn().mockResolvedValue(batchResult),
		});
		const result = (await call(batchSendHandler, {
			body: {
				customerIds: ["cust-a", "cust-b", "cust-bad"],
				title: "Flash sale",
				body: "50% off today only!",
				type: "promotion",
			},
			controller: ctrl,
		})) as BatchSendResult;
		expect(result.sent).toBe(2);
		expect(result.failed).toBe(1);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].customerId).toBe("cust-bad");
	});

	it("returns zero-state when all succeed", async () => {
		const ctrl = makeController({
			batchSend: vi.fn().mockResolvedValue({
				sent: 5,
				failed: 0,
				errors: [],
			} satisfies BatchSendResult),
		});
		const result = (await call(batchSendHandler, {
			body: {
				customerIds: ["a", "b", "c", "d", "e"],
				title: "Hi",
				body: "Hey",
			},
			controller: ctrl,
		})) as BatchSendResult;
		expect(result.sent).toBe(5);
		expect(result.failed).toBe(0);
	});
});

// ── admin GET /notifications/stats ───────────────────────────────────────────

describe("admin GET /notifications/stats", () => {
	it("returns stats from controller", async () => {
		const stats: NotificationStats = {
			total: 100,
			unread: 25,
			byType: { info: 40, order: 35, shipping: 25 },
			byPriority: { normal: 70, high: 20, urgent: 10 },
		};
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: NotificationStats;
		};
		expect(result.stats.total).toBe(100);
		expect(result.stats.unread).toBe(25);
		expect(result.stats.byType.order).toBe(35);
		expect(result.stats.byPriority.urgent).toBe(10);
	});

	it("returns zero-state stats when no notifications", async () => {
		const result = (await call(statsHandler)) as { stats: NotificationStats };
		expect(result.stats.total).toBe(0);
		expect(result.stats.unread).toBe(0);
	});
});

// ── admin GET /notifications/preferences ─────────────────────────────────────

describe("admin GET /notifications/preferences", () => {
	it("returns empty preferences list", async () => {
		const result = (await call(listPreferencesHandler)) as {
			preferences: NotificationPreference[];
		};
		expect(result.preferences).toHaveLength(0);
	});

	it("returns preferences list from controller", async () => {
		const prefs = [makePreference(), makePreference({ customerId: "cust-2" })];
		const ctrl = makeController({
			listPreferences: vi.fn().mockResolvedValue(prefs),
		});
		const result = (await call(listPreferencesHandler, {
			controller: ctrl,
		})) as { preferences: NotificationPreference[] };
		expect(result.preferences).toHaveLength(2);
	});
});

// ── admin GET /notifications/preferences/:customerId ─────────────────────────

describe("admin GET /notifications/preferences/:customerId", () => {
	it("returns preferences for customer", async () => {
		const pref = makePreference({ customerId: "cust-5" });
		const ctrl = makeController({
			getPreferences: vi.fn().mockResolvedValue(pref),
		});
		const result = (await call(getCustomerPreferencesHandler, {
			params: { customerId: "cust-5" },
			controller: ctrl,
		})) as { preferences: NotificationPreference };
		expect(result.preferences.customerId).toBe("cust-5");
		expect(ctrl.getPreferences).toHaveBeenCalledWith("cust-5");
	});
});

// ── admin POST /notifications/preferences/:customerId/update ─────────────────

describe("admin POST /notifications/preferences/:customerId/update", () => {
	it("updates and returns preferences", async () => {
		const updated = makePreference({ customerId: "cust-6", promotions: true });
		const ctrl = makeController({
			updatePreferences: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateCustomerPreferencesHandler, {
			params: { customerId: "cust-6" },
			body: { promotions: true },
			controller: ctrl,
		})) as { preferences: NotificationPreference };
		expect(result.preferences.promotions).toBe(true);
		expect(ctrl.updatePreferences).toHaveBeenCalledWith(
			"cust-6",
			expect.objectContaining({ promotions: true }),
		);
	});
});

// ── admin POST /notifications/preferences/:customerId/delete ─────────────────

describe("admin POST /notifications/preferences/:customerId/delete", () => {
	it("returns 404 with status when preferences not found", async () => {
		const result = (await call(deleteCustomerPreferencesHandler, {
			params: { customerId: "cust-ghost" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Preferences not found");
		expect(result.status).toBe(404);
	});

	it("returns deleted: true when preferences found and deleted", async () => {
		const ctrl = makeController({
			deletePreferences: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteCustomerPreferencesHandler, {
			params: { customerId: "cust-7" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.deletePreferences).toHaveBeenCalledWith("cust-7");
	});
});

// ── admin GET /notifications/templates ───────────────────────────────────────

describe("admin GET /notifications/templates", () => {
	it("returns empty templates list", async () => {
		const result = (await call(listTemplatesHandler)) as {
			templates: NotificationTemplate[];
			total: number;
		};
		expect(result.templates).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns templates from controller", async () => {
		const templates = [
			makeTemplate(),
			makeTemplate({ slug: "shipping-update" }),
		];
		const ctrl = makeController({
			listTemplates: vi.fn().mockResolvedValue(templates),
		});
		const result = (await call(listTemplatesHandler, {
			controller: ctrl,
		})) as { templates: NotificationTemplate[]; total: number };
		expect(result.templates).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("passes active filter to controller", async () => {
		const ctrl = makeController();
		await call(listTemplatesHandler, {
			query: { active: "true" },
			controller: ctrl,
		});
		expect(ctrl.listTemplates).toHaveBeenCalledWith(
			expect.objectContaining({ active: true }),
		);
	});
});

// ── admin GET /notifications/templates/:id ───────────────────────────────────

describe("admin GET /notifications/templates/:id", () => {
	it("returns 404 with status when template not found", async () => {
		const result = (await call(getTemplateHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Template not found");
		expect(result.status).toBe(404);
	});

	it("returns template when found", async () => {
		const template = makeTemplate({ id: "tmpl-1" });
		const ctrl = makeController({
			getTemplate: vi.fn().mockResolvedValue(template),
		});
		const result = (await call(getTemplateHandler, {
			params: { id: "tmpl-1" },
			controller: ctrl,
		})) as { template: NotificationTemplate };
		expect(result.template.id).toBe("tmpl-1");
		expect(ctrl.getTemplate).toHaveBeenCalledWith("tmpl-1");
	});
});

// ── admin POST /notifications/templates/create ───────────────────────────────

describe("admin POST /notifications/templates/create", () => {
	it("returns 409 with status when slug already exists", async () => {
		const existing = makeTemplate({ slug: "welcome-email" });
		const ctrl = makeController({
			getTemplateBySlug: vi.fn().mockResolvedValue(existing),
		});
		const result = (await call(createTemplateHandler, {
			body: {
				slug: "welcome-email",
				name: "Duplicate",
				titleTemplate: "Hi",
				bodyTemplate: "Body",
			},
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(409);
		expect(result.error).toMatch(/already exists/i);
	});

	it("creates template when slug is unique", async () => {
		const template = makeTemplate({ slug: "promo-blast", name: "Promo Blast" });
		const ctrl = makeController({
			getTemplateBySlug: vi.fn().mockResolvedValue(null),
			createTemplate: vi.fn().mockResolvedValue(template),
		});
		const result = (await call(createTemplateHandler, {
			body: {
				slug: "promo-blast",
				name: "Promo Blast",
				titleTemplate: "Big sale!",
				bodyTemplate: "Up to 50% off",
			},
			controller: ctrl,
		})) as { template: NotificationTemplate };
		expect(result.template.slug).toBe("promo-blast");
		expect(ctrl.createTemplate).toHaveBeenCalledWith(
			expect.objectContaining({ slug: "promo-blast", name: "Promo Blast" }),
		);
	});
});

// ── admin POST /notifications/templates/:id/update ───────────────────────────

describe("admin POST /notifications/templates/:id/update", () => {
	it("returns 404 with status when template not found", async () => {
		const result = (await call(updateTemplateHandler, {
			params: { id: "missing" },
			body: { name: "New name" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Template not found");
		expect(result.status).toBe(404);
	});

	it("returns updated template on success", async () => {
		const updated = makeTemplate({ id: "tmpl-2", name: "Renamed" });
		const ctrl = makeController({
			updateTemplate: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateTemplateHandler, {
			params: { id: "tmpl-2" },
			body: { name: "Renamed" },
			controller: ctrl,
		})) as { template: NotificationTemplate };
		expect(result.template.name).toBe("Renamed");
		expect(ctrl.updateTemplate).toHaveBeenCalledWith(
			"tmpl-2",
			expect.objectContaining({ name: "Renamed" }),
		);
	});
});

// ── admin POST /notifications/templates/:id/delete ───────────────────────────

describe("admin POST /notifications/templates/:id/delete", () => {
	it("returns 404 with status when template not found", async () => {
		const result = (await call(deleteTemplateHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Template not found");
		expect(result.status).toBe(404);
	});

	it("returns success: true when deleted", async () => {
		const ctrl = makeController({
			deleteTemplate: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteTemplateHandler, {
			params: { id: "tmpl-3" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteTemplate).toHaveBeenCalledWith("tmpl-3");
	});
});

// ── admin POST /notifications/templates/send ─────────────────────────────────

describe("admin POST /notifications/templates/send", () => {
	it("creates one in-app notification per recipient from the stored template", async () => {
		const ctrl = makeController({
			getTemplate: vi
				.fn()
				.mockResolvedValue(makeTemplate({ channel: "in_app" })),
		});
		const result = await call(sendFromTemplateHandler, {
			body: {
				templateId: "tmpl-4",
				customerIds: ["c1", "c2", "c3"],
				variables: { name: "World" },
			},
			controller: ctrl,
		});

		expect(result).toEqual({ sent: 3, failed: 0, errors: [] });
		expect(ctrl.create).toHaveBeenCalledTimes(3);
		expect(ctrl.create).toHaveBeenCalledWith({
			customerId: "c1",
			type: "info",
			channel: "in_app",
			priority: "normal",
			title: "Welcome, World!",
			body: "Thanks for signing up.",
			actionUrl: undefined,
			metadata: {
				templateId: expect.any(String),
				templateSlug: "welcome-email",
			},
		});
		expect(ctrl.sendFromTemplate).not.toHaveBeenCalled();
	});

	it("reports each in-app persistence failure without invoking external delivery", async () => {
		const create = vi
			.fn()
			.mockResolvedValueOnce(makeNotification({ customerId: "good" }))
			.mockRejectedValueOnce(new Error("Invalid recipient"))
			.mockRejectedValueOnce(new Error("Recipient unavailable"));
		const ctrl = makeController({
			getTemplate: vi
				.fn()
				.mockResolvedValue(makeTemplate({ channel: "in_app" })),
			create,
		});
		const result = await call(sendFromTemplateHandler, {
			body: { templateId: "tmpl-5", customerIds: ["good", "bad-1", "bad-2"] },
			controller: ctrl,
		});

		expect(result).toEqual({
			sent: 1,
			failed: 2,
			errors: [
				{ customerId: "bad-1", error: "Invalid recipient" },
				{ customerId: "bad-2", error: "Recipient unavailable" },
			],
		});
		expect(ctrl.sendFromTemplate).not.toHaveBeenCalled();
	});

	it("contains external templates before creating or dispatching notifications", async () => {
		const ctrl = makeController({
			getTemplate: vi
				.fn()
				.mockResolvedValue(makeTemplate({ channel: "email" })),
		});
		const result = await call(sendFromTemplateHandler, {
			body: { templateId: "tmpl-email", customerIds: ["c1"] },
			controller: ctrl,
		});

		expect(result).toMatchObject({
			code: "NOTIFICATION_DELIVERY_DURABILITY_REQUIRED",
			status: 503,
		});
		expect(ctrl.create).not.toHaveBeenCalled();
		expect(ctrl.sendFromTemplate).not.toHaveBeenCalled();
	});
});

// ── admin GET /notifications/settings ────────────────────────────────────────

describe("admin GET /notifications/settings", () => {
	it("returns not_configured for both channels when options are empty", async () => {
		const result = (await call(settingsHandler)) as {
			email: { status: string; configured: boolean; provider: string };
			sms: { status: string; configured: boolean; provider: string };
		};
		expect(result.email.status).toBe("not_configured");
		expect(result.email.configured).toBe(false);
		expect(result.email.provider).toBe("resend");
		expect(result.sms.status).toBe("not_configured");
		expect(result.sms.configured).toBe(false);
		expect(result.sms.provider).toBe("twilio");
	});

	it("masks api key and shows null fromAddress when not configured", async () => {
		const result = (await call(settingsHandler)) as {
			email: { apiKeyMasked: string | null; fromAddress: string | null };
			sms: { accountSidMasked: string | null; fromNumber: string | null };
		};
		expect(result.email.apiKeyMasked).toBeNull();
		expect(result.email.fromAddress).toBeNull();
		expect(result.sms.accountSidMasked).toBeNull();
		expect(result.sms.fromNumber).toBeNull();
	});
});
