import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Notification, NotificationPreference } from "../service";
import { createNotificationsController } from "../service-impl";

/**
 * Store endpoint integration tests for the notifications module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-notifications: auth required, returns customer's notifications
 * 2. get-unread-count: auth required, returns unread count
 * 3. mark-read: auth required, marks single notification as read
 * 4. mark-all-read: auth required, marks all as read for customer
 * 5. get-preferences: auth required, returns notification preferences
 * 6. update-preferences: auth required, updates preferences
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListNotifications(
	data: DataService,
	opts: { customerId?: string; type?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createNotificationsController(data);
	const notifications = await controller.list({
		customerId: opts.customerId,
		type: opts.type as Notification["type"] | undefined,
	});
	return { notifications };
}

async function simulateGetUnreadCount(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createNotificationsController(data);
	const count = await controller.unreadCount(opts.customerId);
	return { count };
}

async function simulateMarkRead(
	data: DataService,
	notificationId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createNotificationsController(data);
	const notification = await controller.get(notificationId);
	if (!notification || notification.customerId !== opts.customerId) {
		return { error: "Notification not found", status: 404 };
	}
	const updated = await controller.markRead(notificationId);
	return { notification: updated };
}

async function simulateMarkAllRead(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createNotificationsController(data);
	await controller.markAllRead(opts.customerId);
	return { success: true };
}

async function simulateGetPreferences(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createNotificationsController(data);
	const preferences = await controller.getPreferences(opts.customerId);
	return { preferences };
}

async function simulateUpdatePreferences(
	data: DataService,
	body: Partial<
		Pick<
			NotificationPreference,
			"orderUpdates" | "promotions" | "shippingAlerts" | "accountAlerts"
		>
	>,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createNotificationsController(data);
	const preferences = await controller.updatePreferences(opts.customerId, body);
	return { preferences };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list notifications — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateListNotifications(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns customer notifications", async () => {
		const ctrl = createNotificationsController(data);
		await ctrl.create({
			customerId: "cust_1",
			type: "order",
			title: "Order shipped",
			body: "Your order is on the way.",
		});
		await ctrl.create({
			customerId: "cust_2",
			type: "order",
			title: "Other order",
			body: "Not yours.",
		});

		const result = await simulateListNotifications(data, {
			customerId: "cust_1",
		});

		expect("notifications" in result).toBe(true);
		if ("notifications" in result) {
			expect(result.notifications).toHaveLength(1);
			expect((result.notifications[0] as Notification).title).toBe(
				"Order shipped",
			);
		}
	});

	it("returns empty for customer with no notifications", async () => {
		const result = await simulateListNotifications(data, {
			customerId: "cust_empty",
		});

		expect("notifications" in result).toBe(true);
		if ("notifications" in result) {
			expect(result.notifications).toHaveLength(0);
		}
	});

	it("filters by notification type", async () => {
		const ctrl = createNotificationsController(data);
		await ctrl.create({
			customerId: "cust_1",
			type: "order",
			title: "Order update",
			body: "Status changed.",
		});
		await ctrl.create({
			customerId: "cust_1",
			type: "promotion",
			title: "Sale!",
			body: "50% off everything.",
		});

		const result = await simulateListNotifications(data, {
			customerId: "cust_1",
			type: "order",
		});

		expect("notifications" in result).toBe(true);
		if ("notifications" in result) {
			expect(result.notifications).toHaveLength(1);
			expect((result.notifications[0] as Notification).type).toBe("order");
		}
	});
});

describe("store endpoint: unread count — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateGetUnreadCount(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns unread count for customer", async () => {
		const ctrl = createNotificationsController(data);
		await ctrl.create({
			customerId: "cust_1",
			type: "info",
			title: "Notice 1",
			body: "Info 1",
		});
		await ctrl.create({
			customerId: "cust_1",
			type: "info",
			title: "Notice 2",
			body: "Info 2",
		});

		const result = await simulateGetUnreadCount(data, {
			customerId: "cust_1",
		});

		expect("count" in result).toBe(true);
		if ("count" in result) {
			expect(result.count).toBe(2);
		}
	});

	it("returns zero when all are read", async () => {
		const ctrl = createNotificationsController(data);
		const n = await ctrl.create({
			customerId: "cust_1",
			type: "info",
			title: "Read me",
			body: "Already read.",
		});
		await ctrl.markRead(n.id);

		const result = await simulateGetUnreadCount(data, {
			customerId: "cust_1",
		});

		expect("count" in result).toBe(true);
		if ("count" in result) {
			expect(result.count).toBe(0);
		}
	});
});

describe("store endpoint: mark read — auth + ownership", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMarkRead(data, "notif_1");
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("marks a notification as read", async () => {
		const ctrl = createNotificationsController(data);
		const n = await ctrl.create({
			customerId: "cust_1",
			type: "order",
			title: "Shipped",
			body: "Your order shipped.",
		});
		expect(n.read).toBe(false);

		const result = await simulateMarkRead(data, n.id, {
			customerId: "cust_1",
		});

		expect("notification" in result).toBe(true);
		if ("notification" in result && result.notification) {
			expect(result.notification.read).toBe(true);
		}
	});

	it("returns 404 for another customer's notification", async () => {
		const ctrl = createNotificationsController(data);
		const n = await ctrl.create({
			customerId: "cust_1",
			type: "info",
			title: "Private",
			body: "Not for you.",
		});

		const result = await simulateMarkRead(data, n.id, {
			customerId: "cust_2",
		});

		expect(result).toEqual({ error: "Notification not found", status: 404 });
	});

	it("returns 404 for nonexistent notification", async () => {
		const result = await simulateMarkRead(data, "ghost_id", {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Notification not found", status: 404 });
	});
});

describe("store endpoint: mark all read — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMarkAllRead(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("marks all notifications as read for customer", async () => {
		const ctrl = createNotificationsController(data);
		await ctrl.create({
			customerId: "cust_1",
			type: "info",
			title: "A",
			body: "First",
		});
		await ctrl.create({
			customerId: "cust_1",
			type: "order",
			title: "B",
			body: "Second",
		});

		const result = await simulateMarkAllRead(data, {
			customerId: "cust_1",
		});
		expect(result).toEqual({ success: true });

		const count = await ctrl.unreadCount("cust_1");
		expect(count).toBe(0);
	});

	it("does not affect other customers", async () => {
		const ctrl = createNotificationsController(data);
		await ctrl.create({
			customerId: "cust_1",
			type: "info",
			title: "Mine",
			body: "My notification",
		});
		await ctrl.create({
			customerId: "cust_2",
			type: "info",
			title: "Theirs",
			body: "Their notification",
		});

		await simulateMarkAllRead(data, { customerId: "cust_1" });

		const count1 = await ctrl.unreadCount("cust_1");
		const count2 = await ctrl.unreadCount("cust_2");
		expect(count1).toBe(0);
		expect(count2).toBe(1);
	});
});

describe("store endpoint: get preferences — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateGetPreferences(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns preferences for customer", async () => {
		const ctrl = createNotificationsController(data);
		await ctrl.updatePreferences("cust_1", {
			orderUpdates: true,
			promotions: false,
		});

		const result = await simulateGetPreferences(data, {
			customerId: "cust_1",
		});

		expect("preferences" in result).toBe(true);
		if ("preferences" in result && result.preferences) {
			expect(result.preferences.orderUpdates).toBe(true);
			expect(result.preferences.promotions).toBe(false);
		}
	});

	it("returns default preferences for customer without custom settings", async () => {
		const result = await simulateGetPreferences(data, {
			customerId: "cust_new",
		});

		expect("preferences" in result).toBe(true);
		if ("preferences" in result && result.preferences) {
			// Default preferences have all channels enabled
			expect(result.preferences.orderUpdates).toBe(true);
			expect(result.preferences.promotions).toBe(true);
		}
	});
});

describe("store endpoint: update preferences — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateUpdatePreferences(data, {
			promotions: false,
		});
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("creates preferences for new customer", async () => {
		const result = await simulateUpdatePreferences(
			data,
			{ orderUpdates: true, promotions: false },
			{ customerId: "cust_1" },
		);

		expect("preferences" in result).toBe(true);
		if ("preferences" in result) {
			expect(result.preferences.orderUpdates).toBe(true);
			expect(result.preferences.promotions).toBe(false);
		}
	});

	it("updates existing preferences", async () => {
		const ctrl = createNotificationsController(data);
		await ctrl.updatePreferences("cust_1", {
			orderUpdates: true,
			promotions: true,
		});

		const result = await simulateUpdatePreferences(
			data,
			{ promotions: false },
			{ customerId: "cust_1" },
		);

		expect("preferences" in result).toBe(true);
		if ("preferences" in result) {
			expect(result.preferences.promotions).toBe(false);
		}
	});
});
