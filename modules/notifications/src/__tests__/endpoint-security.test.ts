import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { NotificationType } from "../service";
import { createNotificationsController } from "../service-impl";

/**
 * Security regression tests for notifications endpoints.
 *
 * Notifications contain customer-specific data and preferences.
 * These tests verify:
 * - Recipient isolation: customer A cannot see customer B's notifications
 * - Read status isolation: marking read for one customer doesn't affect another
 * - Bulk operations scoped to user: markAllRead/bulkDelete stay within customer boundary
 * - Channel preference integrity: one customer's preferences don't leak to another
 * - Notification type filtering: type filters don't cross customer boundaries
 */

function createNotification(
	controller: ReturnType<typeof createNotificationsController>,
	customerId: string,
	overrides: {
		type?: NotificationType;
		title?: string;
		body?: string;
	} = {},
) {
	return controller.create({
		customerId,
		title: overrides.title ?? "Test notification",
		body: overrides.body ?? "Test body",
		type: overrides.type,
	});
}

describe("notifications endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createNotificationsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createNotificationsController(mockData);
	});

	// ── Recipient Isolation ──────────────────────────────────────────

	describe("recipient isolation", () => {
		it("list filtered by customerId never returns other customers' notifications", async () => {
			await createNotification(controller, "victim", { title: "Secret" });
			await createNotification(controller, "victim", { title: "Private" });
			await createNotification(controller, "attacker", { title: "Mine" });

			const attackerNotifs = await controller.list({ customerId: "attacker" });
			expect(attackerNotifs).toHaveLength(1);
			for (const n of attackerNotifs) {
				expect(n.customerId).toBe("attacker");
			}
		});

		it("get exposes notification regardless of customerId (endpoint must check ownership)", async () => {
			const victimNotif = await createNotification(controller, "victim");
			// The controller's get does NOT check ownership — endpoint must verify
			const result = await controller.get(victimNotif.id);
			expect(result).not.toBeNull();
			expect(result?.customerId).toBe("victim");
		});

		it("unreadCount only counts notifications for the specified customer", async () => {
			await createNotification(controller, "cust-a");
			await createNotification(controller, "cust-a");
			await createNotification(controller, "cust-b");

			expect(await controller.unreadCount("cust-a")).toBe(2);
			expect(await controller.unreadCount("cust-b")).toBe(1);
			expect(await controller.unreadCount("cust-c")).toBe(0);
		});

		it("update does not check customerId — endpoint must enforce ownership", async () => {
			const victimNotif = await createNotification(controller, "victim", {
				title: "Original",
			});

			// Controller allows update without ownership check
			const updated = await controller.update(victimNotif.id, {
				title: "Tampered",
			});
			expect(updated?.title).toBe("Tampered");
			expect(updated?.customerId).toBe("victim");
		});

		it("delete does not check customerId — endpoint must enforce ownership", async () => {
			const victimNotif = await createNotification(controller, "victim");

			// Controller allows delete without ownership check
			const deleted = await controller.delete(victimNotif.id);
			expect(deleted).toBe(true);
			expect(await controller.get(victimNotif.id)).toBeNull();
		});
	});

	// ── Read Status Isolation ────────────────────────────────────────

	describe("read status isolation", () => {
		it("markRead on one customer's notification does not affect another's", async () => {
			const custANotif = await createNotification(controller, "cust-a");
			const custBNotif = await createNotification(controller, "cust-b");

			await controller.markRead(custANotif.id);

			const custBResult = await controller.get(custBNotif.id);
			expect(custBResult?.read).toBe(false);
			expect(custBResult?.readAt).toBeUndefined();
		});

		it("markAllRead only affects the specified customer", async () => {
			await createNotification(controller, "cust-a");
			await createNotification(controller, "cust-a");
			await createNotification(controller, "cust-b");
			await createNotification(controller, "cust-b");
			await createNotification(controller, "cust-b");

			const count = await controller.markAllRead("cust-a");
			expect(count).toBe(2);

			// cust-b should still have all unread
			expect(await controller.unreadCount("cust-b")).toBe(3);
		});

		it("markRead is idempotent and preserves original readAt", async () => {
			const notif = await createNotification(controller, "cust-a");
			const first = await controller.markRead(notif.id);
			const originalReadAt = first?.readAt;

			const second = await controller.markRead(notif.id);
			expect(second?.read).toBe(true);
			expect(second?.readAt).toEqual(originalReadAt);
		});

		it("markRead returns null for non-existent id — no information leak", async () => {
			const result = await controller.markRead("non-existent-id");
			expect(result).toBeNull();
		});
	});

	// ── Bulk Operations Scoping ──────────────────────────────────────

	describe("bulk operations scoped to user", () => {
		it("bulkDelete only deletes specified ids, not other customers' notifications", async () => {
			const victimNotif = await createNotification(controller, "victim");
			const attackerNotif = await createNotification(controller, "attacker");

			// Attacker tries to delete only their own ids
			await controller.bulkDelete([attackerNotif.id]);

			// Victim's notification should be untouched
			const victimResult = await controller.get(victimNotif.id);
			expect(victimResult).not.toBeNull();
			expect(victimResult?.customerId).toBe("victim");
		});

		it("bulkDelete with victim ids succeeds — endpoint must validate ownership", async () => {
			const victimNotif1 = await createNotification(controller, "victim");
			const victimNotif2 = await createNotification(controller, "victim");

			// Controller does not check ownership on bulkDelete
			const count = await controller.bulkDelete([
				victimNotif1.id,
				victimNotif2.id,
			]);
			expect(count).toBe(2);
		});

		it("bulkDelete with non-existent ids returns 0 — no error leak", async () => {
			const count = await controller.bulkDelete(["fake-id-1", "fake-id-2"]);
			expect(count).toBe(0);
		});

		it("bulkDelete of empty array returns 0", async () => {
			const count = await controller.bulkDelete([]);
			expect(count).toBe(0);
		});

		it("markAllRead returns 0 for customer with no notifications", async () => {
			await createNotification(controller, "cust-a");
			const count = await controller.markAllRead("nonexistent-customer");
			expect(count).toBe(0);
		});
	});

	// ── Channel Preference Integrity ─────────────────────────────────

	describe("channel preference integrity", () => {
		it("preferences are isolated between customers", async () => {
			await controller.updatePreferences("cust-a", {
				promotions: false,
				shippingAlerts: false,
			});
			await controller.updatePreferences("cust-b", {
				orderUpdates: false,
				accountAlerts: false,
			});

			const prefsA = await controller.getPreferences("cust-a");
			expect(prefsA.promotions).toBe(false);
			expect(prefsA.shippingAlerts).toBe(false);
			expect(prefsA.orderUpdates).toBe(true);
			expect(prefsA.accountAlerts).toBe(true);

			const prefsB = await controller.getPreferences("cust-b");
			expect(prefsB.promotions).toBe(true);
			expect(prefsB.shippingAlerts).toBe(true);
			expect(prefsB.orderUpdates).toBe(false);
			expect(prefsB.accountAlerts).toBe(false);
		});

		it("updating one customer's preferences does not alter another's", async () => {
			await controller.updatePreferences("cust-a", { promotions: false });
			const prefsBBefore = await controller.getPreferences("cust-b");
			expect(prefsBBefore.promotions).toBe(true);

			await controller.updatePreferences("cust-a", { promotions: true });
			const prefsBAfter = await controller.getPreferences("cust-b");
			expect(prefsBAfter.promotions).toBe(true);
		});

		it("getPreferences returns defaults for unknown customer — no data leak", async () => {
			await controller.updatePreferences("real-customer", {
				promotions: false,
			});

			const prefs = await controller.getPreferences("unknown-customer");
			expect(prefs.customerId).toBe("unknown-customer");
			expect(prefs.orderUpdates).toBe(true);
			expect(prefs.promotions).toBe(true);
			expect(prefs.shippingAlerts).toBe(true);
			expect(prefs.accountAlerts).toBe(true);
		});

		it("preference id is stable across updates for the same customer", async () => {
			const first = await controller.updatePreferences("cust-a", {
				promotions: false,
			});
			const second = await controller.updatePreferences("cust-a", {
				orderUpdates: false,
			});
			expect(second.id).toBe(first.id);
			expect(second.customerId).toBe("cust-a");
		});
	});

	// ── Notification Type Filtering ──────────────────────────────────

	describe("notification type filtering", () => {
		it("type filter does not cross customer boundaries", async () => {
			await createNotification(controller, "cust-a", { type: "order" });
			await createNotification(controller, "cust-b", { type: "order" });
			await createNotification(controller, "cust-a", { type: "shipping" });

			const custAOrders = await controller.list({
				customerId: "cust-a",
				type: "order",
			});
			expect(custAOrders).toHaveLength(1);
			expect(custAOrders[0]?.customerId).toBe("cust-a");
			expect(custAOrders[0]?.type).toBe("order");
		});

		it("combining read and type filters respects customer scope", async () => {
			const orderNotif = await createNotification(controller, "cust-a", {
				type: "order",
			});
			await createNotification(controller, "cust-a", { type: "order" });
			await createNotification(controller, "cust-b", { type: "order" });
			await controller.markRead(orderNotif.id);

			const unreadOrders = await controller.list({
				customerId: "cust-a",
				type: "order",
				read: false,
			});
			expect(unreadOrders).toHaveLength(1);
			expect(unreadOrders[0]?.customerId).toBe("cust-a");
			expect(unreadOrders[0]?.read).toBe(false);
		});

		it("getStats aggregates across all customers — admin-only endpoint", async () => {
			await createNotification(controller, "cust-a", { type: "order" });
			await createNotification(controller, "cust-b", { type: "order" });
			await createNotification(controller, "cust-a", { type: "promotion" });

			const stats = await controller.getStats();
			// Stats include ALL customers — endpoints must restrict to admin
			expect(stats.total).toBe(3);
			expect(stats.byType.order).toBe(2);
			expect(stats.byType.promotion).toBe(1);
		});

		it("list without customerId returns all notifications — admin-only", async () => {
			await createNotification(controller, "cust-a");
			await createNotification(controller, "cust-b");
			await createNotification(controller, "cust-c");

			const all = await controller.list();
			expect(all).toHaveLength(3);
		});
	});
});
