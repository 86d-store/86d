import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createNotificationsController } from "../service-impl";

describe("notifications controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createNotificationsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createNotificationsController(mockData);
	});

	// ── create edge cases ──────────────────────────────────────────────

	describe("create edge cases", () => {
		it("handles empty string title and body", async () => {
			const n = await controller.create({
				customerId: "cust-1",
				title: "",
				body: "",
			});
			expect(n.title).toBe("");
			expect(n.body).toBe("");
		});

		it("handles special characters in title and body", async () => {
			const n = await controller.create({
				customerId: "cust-1",
				title: 'Sale <50% off> & "free" shipping!',
				body: "Line1\nLine2\tTabbed @#$%^&*()",
			});
			expect(n.title).toBe('Sale <50% off> & "free" shipping!');
			expect(n.body).toBe("Line1\nLine2\tTabbed @#$%^&*()");
		});

		it("handles very long strings in title and body", async () => {
			const longTitle = "T".repeat(10000);
			const longBody = "B".repeat(10000);
			const n = await controller.create({
				customerId: "cust-1",
				title: longTitle,
				body: longBody,
			});
			expect(n.title).toBe(longTitle);
			expect(n.body).toBe(longBody);
		});

		it("handles unicode and emoji in title and body", async () => {
			const n = await controller.create({
				customerId: "cust-1",
				title: "\u{1F4E6} \u00C9\u00E0\u00FC\u00F1 \u4F60\u597D",
				body: "\u2764\uFE0F\u200D\u{1F525} Cr\u00E8me br\u00FBl\u00E9e",
			});
			expect(n.title).toBe("\u{1F4E6} \u00C9\u00E0\u00FC\u00F1 \u4F60\u597D");
			expect(n.body).toBe(
				"\u2764\uFE0F\u200D\u{1F525} Cr\u00E8me br\u00FBl\u00E9e",
			);
		});

		it("creates with all notification types", async () => {
			const types = [
				"info",
				"success",
				"warning",
				"error",
				"order",
				"shipping",
				"promotion",
			] as const;
			for (const type of types) {
				const n = await controller.create({
					customerId: "cust-1",
					type,
					title: `Type ${type}`,
					body: "body",
				});
				expect(n.type).toBe(type);
			}
		});

		it("creates with all channel types", async () => {
			const channels = ["in_app", "email", "both"] as const;
			for (const channel of channels) {
				const n = await controller.create({
					customerId: "cust-1",
					channel,
					title: `Channel ${channel}`,
					body: "body",
				});
				expect(n.channel).toBe(channel);
			}
		});

		it("handles deeply nested metadata", async () => {
			const meta = {
				level1: {
					level2: {
						level3: { value: "deep" },
					},
				},
				array: [1, 2, { nested: true }],
			};
			const n = await controller.create({
				customerId: "cust-1",
				title: "Deep meta",
				body: "body",
				metadata: meta,
			});
			expect(n.metadata).toEqual(meta);
		});

		it("createdAt is set to approximately current time", async () => {
			const before = new Date();
			const n = await controller.create({
				customerId: "cust-1",
				title: "Time test",
				body: "body",
			});
			const after = new Date();
			expect(n.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(n.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("creates many notifications rapidly and all get unique ids", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 50; i++) {
				const n = await controller.create({
					customerId: `cust-${i}`,
					title: `Notification ${i}`,
					body: `body ${i}`,
				});
				ids.add(n.id);
			}
			expect(ids.size).toBe(50);
		});

		it("actionUrl can be an empty string", async () => {
			const n = await controller.create({
				customerId: "cust-1",
				title: "Test",
				body: "body",
				actionUrl: "",
			});
			expect(n.actionUrl).toBe("");
		});
	});

	// ── get edge cases ─────────────────────────────────────────────────

	describe("get edge cases", () => {
		it("returns null for empty string id", async () => {
			const found = await controller.get("");
			expect(found).toBeNull();
		});

		it("returns correct notification when many exist", async () => {
			const created: Awaited<ReturnType<typeof controller.create>>[] = [];
			for (let i = 0; i < 20; i++) {
				const n = await controller.create({
					customerId: `cust-${i}`,
					title: `Notification ${i}`,
					body: `body ${i}`,
				});
				created.push(n);
			}
			const found = await controller.get(created[10].id);
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Notification 10");
			expect(found?.customerId).toBe("cust-10");
		});

		it("returns null after notification is deleted", async () => {
			const n = await controller.create({
				customerId: "cust-1",
				title: "Will delete",
				body: "body",
			});
			await controller.delete(n.id);
			expect(await controller.get(n.id)).toBeNull();
		});
	});

	// ── update edge cases ──────────────────────────────────────────────

	describe("update edge cases", () => {
		it("update with empty params object preserves all fields", async () => {
			const created = await controller.create({
				customerId: "cust-1",
				title: "Original",
				body: "Original body",
				actionUrl: "https://example.com",
				metadata: { key: "value" },
			});
			const updated = await controller.update(created.id, {});
			expect(updated?.title).toBe("Original");
			expect(updated?.body).toBe("Original body");
			expect(updated?.actionUrl).toBe("https://example.com");
			expect(updated?.metadata).toEqual({ key: "value" });
		});

		it("update title and body to empty strings", async () => {
			const created = await controller.create({
				customerId: "cust-1",
				title: "Has title",
				body: "Has body",
			});
			const updated = await controller.update(created.id, {
				title: "",
				body: "",
			});
			expect(updated?.title).toBe("");
			expect(updated?.body).toBe("");
		});

		it("update metadata to empty object replaces existing metadata", async () => {
			const created = await controller.create({
				customerId: "cust-1",
				title: "Test",
				body: "body",
				metadata: { important: true, orderId: "123" },
			});
			const updated = await controller.update(created.id, { metadata: {} });
			expect(updated?.metadata).toEqual({});
		});

		it("multiple sequential updates accumulate correctly", async () => {
			const created = await controller.create({
				customerId: "cust-1",
				title: "V1",
				body: "B1",
			});
			await controller.update(created.id, { title: "V2" });
			await controller.update(created.id, { body: "B2" });
			await controller.update(created.id, {
				actionUrl: "https://example.com",
			});

			const final = await controller.get(created.id);
			expect(final?.title).toBe("V2");
			expect(final?.body).toBe("B2");
			expect(final?.actionUrl).toBe("https://example.com");
		});

		it("update preserves read status and immutable fields", async () => {
			const created = await controller.create({
				customerId: "cust-1",
				type: "order",
				channel: "email",
				title: "Test",
				body: "body",
			});
			await controller.markRead(created.id);
			const updated = await controller.update(created.id, {
				title: "Updated",
			});
			expect(updated?.read).toBe(true);
			expect(updated?.readAt).toBeInstanceOf(Date);
			expect(updated?.customerId).toBe("cust-1");
			expect(updated?.type).toBe("order");
			expect(updated?.channel).toBe("email");
		});
	});

	// ── delete edge cases ──────────────────────────────────────────────

	describe("delete edge cases", () => {
		it("double delete returns false on second attempt", async () => {
			const n = await controller.create({
				customerId: "cust-1",
				title: "Test",
				body: "body",
			});
			expect(await controller.delete(n.id)).toBe(true);
			expect(await controller.delete(n.id)).toBe(false);
		});

		it("returns false for empty string id", async () => {
			expect(await controller.delete("")).toBe(false);
		});

		it("deleting one notification does not affect others", async () => {
			const n1 = await controller.create({
				customerId: "cust-1",
				title: "Keep",
				body: "body",
			});
			const n2 = await controller.create({
				customerId: "cust-1",
				title: "Delete",
				body: "body",
			});
			await controller.delete(n2.id);
			const found = await controller.get(n1.id);
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Keep");
		});
	});

	// ── list edge cases ────────────────────────────────────────────────

	describe("list edge cases", () => {
		it("returns empty array with take=0", async () => {
			await controller.create({
				customerId: "cust-1",
				title: "Test",
				body: "body",
			});
			expect(await controller.list({ take: 0 })).toHaveLength(0);
		});

		it("returns empty array when skip exceeds total items", async () => {
			await controller.create({
				customerId: "cust-1",
				title: "Test",
				body: "body",
			});
			expect(await controller.list({ skip: 100 })).toHaveLength(0);
		});

		it("handles take larger than total items", async () => {
			await controller.create({
				customerId: "cust-1",
				title: "Test",
				body: "body",
			});
			expect(await controller.list({ take: 100 })).toHaveLength(1);
		});

		it("paginates correctly through all items", async () => {
			for (let i = 0; i < 7; i++) {
				await controller.create({
					customerId: "cust-1",
					title: `N${i}`,
					body: `b${i}`,
				});
			}
			const page1 = await controller.list({ take: 3, skip: 0 });
			const page2 = await controller.list({ take: 3, skip: 3 });
			const page3 = await controller.list({ take: 3, skip: 6 });
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			expect(page3).toHaveLength(1);
			const allIds = [
				...page1.map((n) => n.id),
				...page2.map((n) => n.id),
				...page3.map((n) => n.id),
			];
			expect(new Set(allIds).size).toBe(7);
		});

		it("combines customerId and type filters", async () => {
			await controller.create({
				customerId: "cust-1",
				type: "order",
				title: "A",
				body: "a",
			});
			await controller.create({
				customerId: "cust-1",
				type: "shipping",
				title: "B",
				body: "b",
			});
			await controller.create({
				customerId: "cust-2",
				type: "order",
				title: "C",
				body: "c",
			});
			const result = await controller.list({
				customerId: "cust-1",
				type: "order",
			});
			expect(result).toHaveLength(1);
			expect(result[0].title).toBe("A");
		});

		it("combines all three filters: customerId, type, and read", async () => {
			const n1 = await controller.create({
				customerId: "cust-1",
				type: "order",
				title: "Read order",
				body: "a",
			});
			await controller.create({
				customerId: "cust-1",
				type: "order",
				title: "Unread order",
				body: "b",
			});
			await controller.markRead(n1.id);
			const result = await controller.list({
				customerId: "cust-1",
				type: "order",
				read: false,
			});
			expect(result).toHaveLength(1);
			expect(result[0].title).toBe("Unread order");
		});

		it("returns empty when combined filters match nothing", async () => {
			await controller.create({
				customerId: "cust-1",
				type: "order",
				title: "A",
				body: "a",
			});
			expect(
				await controller.list({ customerId: "cust-1", type: "shipping" }),
			).toHaveLength(0);
		});

		it("list with undefined params returns all items", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.create({
					customerId: "cust-1",
					title: `N${i}`,
					body: `b${i}`,
				});
			}
			expect(await controller.list(undefined)).toHaveLength(3);
		});

		it("filters with pagination work together", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create({
					customerId: "cust-1",
					type: "order",
					title: `Order ${i}`,
					body: `b${i}`,
				});
			}
			await controller.create({
				customerId: "cust-1",
				type: "shipping",
				title: "Ship",
				body: "s",
			});
			const result = await controller.list({
				customerId: "cust-1",
				type: "order",
				take: 2,
				skip: 1,
			});
			expect(result).toHaveLength(2);
			for (const n of result) {
				expect(n.type).toBe("order");
			}
		});
	});

	// ── markRead edge cases ────────────────────────────────────────────

	describe("markRead edge cases", () => {
		it("returns null for empty string id", async () => {
			expect(await controller.markRead("")).toBeNull();
		});

		it("markRead preserves all other fields", async () => {
			const created = await controller.create({
				customerId: "cust-1",
				type: "order",
				channel: "both",
				title: "Important",
				body: "Details here",
				actionUrl: "https://example.com",
				metadata: { orderId: "123" },
			});
			const marked = await controller.markRead(created.id);
			expect(marked?.title).toBe("Important");
			expect(marked?.body).toBe("Details here");
			expect(marked?.type).toBe("order");
			expect(marked?.channel).toBe("both");
			expect(marked?.actionUrl).toBe("https://example.com");
			expect(marked?.metadata).toEqual({ orderId: "123" });
			expect(marked?.customerId).toBe("cust-1");
		});

		it("readAt is set to approximately current time on first mark", async () => {
			const created = await controller.create({
				customerId: "cust-1",
				title: "Test",
				body: "body",
			});
			const before = new Date();
			const marked = await controller.markRead(created.id);
			const after = new Date();
			expect(marked?.readAt?.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(marked?.readAt?.getTime()).toBeLessThanOrEqual(after.getTime());
		});
	});

	// ── markAllRead edge cases ─────────────────────────────────────────

	describe("markAllRead edge cases", () => {
		it("returns 0 for non-existent customer", async () => {
			expect(await controller.markAllRead("nonexistent-cust")).toBe(0);
		});

		it("does not affect other customers notifications", async () => {
			await controller.create({
				customerId: "cust-1",
				title: "A",
				body: "a",
			});
			await controller.create({
				customerId: "cust-2",
				title: "B",
				body: "b",
			});
			await controller.markAllRead("cust-1");
			expect(await controller.unreadCount("cust-1")).toBe(0);
			expect(await controller.unreadCount("cust-2")).toBe(1);
		});

		it("calling markAllRead twice returns 0 on second call", async () => {
			await controller.create({
				customerId: "cust-1",
				title: "A",
				body: "a",
			});
			await controller.create({
				customerId: "cust-1",
				title: "B",
				body: "b",
			});
			expect(await controller.markAllRead("cust-1")).toBe(2);
			expect(await controller.markAllRead("cust-1")).toBe(0);
		});

		it("only marks unread ones in a mixed read/unread set", async () => {
			const n1 = await controller.create({
				customerId: "cust-1",
				title: "Already read",
				body: "a",
			});
			await controller.markRead(n1.id);
			await controller.create({
				customerId: "cust-1",
				title: "Unread 1",
				body: "b",
			});
			await controller.create({
				customerId: "cust-1",
				title: "Unread 2",
				body: "c",
			});
			expect(await controller.markAllRead("cust-1")).toBe(2);
		});

		it("handles large number of unread notifications", async () => {
			for (let i = 0; i < 50; i++) {
				await controller.create({
					customerId: "cust-1",
					title: `N${i}`,
					body: `b${i}`,
				});
			}
			expect(await controller.markAllRead("cust-1")).toBe(50);
			expect(await controller.unreadCount("cust-1")).toBe(0);
		});
	});

	// ── unreadCount edge cases ─────────────────────────────────────────

	describe("unreadCount edge cases", () => {
		it("decrements correctly when marking individual notifications", async () => {
			const n1 = await controller.create({
				customerId: "cust-1",
				title: "A",
				body: "a",
			});
			const n2 = await controller.create({
				customerId: "cust-1",
				title: "B",
				body: "b",
			});
			await controller.create({
				customerId: "cust-1",
				title: "C",
				body: "c",
			});

			expect(await controller.unreadCount("cust-1")).toBe(3);
			await controller.markRead(n1.id);
			expect(await controller.unreadCount("cust-1")).toBe(2);
			await controller.markRead(n2.id);
			expect(await controller.unreadCount("cust-1")).toBe(1);
		});

		it("decrements when unread notification is deleted", async () => {
			const n1 = await controller.create({
				customerId: "cust-1",
				title: "A",
				body: "a",
			});
			await controller.create({
				customerId: "cust-1",
				title: "B",
				body: "b",
			});
			expect(await controller.unreadCount("cust-1")).toBe(2);
			await controller.delete(n1.id);
			expect(await controller.unreadCount("cust-1")).toBe(1);
		});

		it("is not affected by read notifications being deleted", async () => {
			const n1 = await controller.create({
				customerId: "cust-1",
				title: "A",
				body: "a",
			});
			await controller.create({
				customerId: "cust-1",
				title: "B",
				body: "b",
			});
			await controller.markRead(n1.id);
			expect(await controller.unreadCount("cust-1")).toBe(1);
			await controller.delete(n1.id);
			expect(await controller.unreadCount("cust-1")).toBe(1);
		});
	});

	// ── getStats edge cases ────────────────────────────────────────────

	describe("getStats edge cases", () => {
		it("stats reflect all seven notification types", async () => {
			const types = [
				"info",
				"success",
				"warning",
				"error",
				"order",
				"shipping",
				"promotion",
			] as const;
			for (const type of types) {
				await controller.create({
					customerId: "cust-1",
					type,
					title: `${type} notification`,
					body: "body",
				});
			}
			const stats = await controller.getStats();
			expect(stats.total).toBe(7);
			expect(stats.unread).toBe(7);
			for (const type of types) {
				expect(stats.byType[type]).toBe(1);
			}
		});

		it("stats update after delete removes type entry", async () => {
			const n1 = await controller.create({
				customerId: "cust-1",
				type: "shipping",
				title: "A",
				body: "a",
			});
			await controller.create({
				customerId: "cust-1",
				type: "order",
				title: "B",
				body: "b",
			});
			await controller.delete(n1.id);
			const stats = await controller.getStats();
			expect(stats.total).toBe(1);
			expect(stats.byType.order).toBe(1);
			expect(stats.byType.shipping).toBeUndefined();
		});

		it("stats across multiple customers", async () => {
			await controller.create({
				customerId: "cust-1",
				type: "order",
				title: "A",
				body: "a",
			});
			await controller.create({
				customerId: "cust-2",
				type: "order",
				title: "B",
				body: "b",
			});
			await controller.create({
				customerId: "cust-3",
				type: "shipping",
				title: "C",
				body: "c",
			});
			const stats = await controller.getStats();
			expect(stats.total).toBe(3);
			expect(stats.unread).toBe(3);
			expect(stats.byType.order).toBe(2);
			expect(stats.byType.shipping).toBe(1);
		});
	});

	// ── bulkDelete edge cases ──────────────────────────────────────────

	describe("bulkDelete edge cases", () => {
		it("returns 0 for empty array", async () => {
			expect(await controller.bulkDelete([])).toBe(0);
		});

		it("handles duplicate ids in the array", async () => {
			const n = await controller.create({
				customerId: "cust-1",
				title: "Test",
				body: "body",
			});
			expect(await controller.bulkDelete([n.id, n.id])).toBe(1);
		});

		it("handles mix of valid and invalid ids", async () => {
			const n1 = await controller.create({
				customerId: "cust-1",
				title: "A",
				body: "a",
			});
			const n2 = await controller.create({
				customerId: "cust-1",
				title: "B",
				body: "b",
			});
			const count = await controller.bulkDelete([
				n1.id,
				"nonexistent-1",
				n2.id,
				"nonexistent-2",
			]);
			expect(count).toBe(2);
			expect(await controller.list()).toHaveLength(0);
		});

		it("bulkDelete all items leaves store empty", async () => {
			const notifications: Awaited<ReturnType<typeof controller.create>>[] = [];
			for (let i = 0; i < 10; i++) {
				const n = await controller.create({
					customerId: "cust-1",
					title: `N${i}`,
					body: `b${i}`,
				});
				notifications.push(n);
			}
			expect(await controller.bulkDelete(notifications.map((n) => n.id))).toBe(
				10,
			);
			expect(mockData.size("notification")).toBe(0);
		});

		it("bulkDelete affects stats correctly", async () => {
			const n1 = await controller.create({
				customerId: "cust-1",
				type: "order",
				title: "A",
				body: "a",
			});
			const n2 = await controller.create({
				customerId: "cust-1",
				type: "shipping",
				title: "B",
				body: "b",
			});
			await controller.create({
				customerId: "cust-1",
				type: "order",
				title: "C",
				body: "c",
			});
			await controller.bulkDelete([n1.id, n2.id]);
			const stats = await controller.getStats();
			expect(stats.total).toBe(1);
			expect(stats.byType.order).toBe(1);
			expect(stats.byType.shipping).toBeUndefined();
		});
	});

	// ── getPreferences edge cases ──────────────────────────────────────

	describe("getPreferences edge cases", () => {
		it("returns defaults with unique id for different customers", async () => {
			const prefs1 = await controller.getPreferences("cust-1");
			const prefs2 = await controller.getPreferences("cust-2");
			expect(prefs1.id).not.toBe(prefs2.id);
			expect(prefs1.customerId).toBe("cust-1");
			expect(prefs2.customerId).toBe("cust-2");
		});

		it("getting preferences does not persist them to the store", async () => {
			await controller.getPreferences("cust-1");
			expect(mockData.size("preference")).toBe(0);
		});

		it("after update, getPreferences returns persisted values", async () => {
			await controller.updatePreferences("cust-1", {
				orderUpdates: false,
				promotions: false,
				shippingAlerts: false,
				accountAlerts: false,
			});
			const prefs = await controller.getPreferences("cust-1");
			expect(prefs.orderUpdates).toBe(false);
			expect(prefs.promotions).toBe(false);
			expect(prefs.shippingAlerts).toBe(false);
			expect(prefs.accountAlerts).toBe(false);
		});
	});

	// ── updatePreferences edge cases ───────────────────────────────────

	describe("updatePreferences edge cases", () => {
		it("update with empty params preserves defaults for new customer", async () => {
			const prefs = await controller.updatePreferences("cust-1", {});
			expect(prefs.orderUpdates).toBe(true);
			expect(prefs.promotions).toBe(true);
			expect(prefs.shippingAlerts).toBe(true);
			expect(prefs.accountAlerts).toBe(true);
		});

		it("toggle all preferences off then on", async () => {
			await controller.updatePreferences("cust-1", {
				orderUpdates: false,
				promotions: false,
				shippingAlerts: false,
				accountAlerts: false,
			});
			const off = await controller.getPreferences("cust-1");
			expect(off.orderUpdates).toBe(false);
			expect(off.promotions).toBe(false);

			await controller.updatePreferences("cust-1", {
				orderUpdates: true,
				promotions: true,
				shippingAlerts: true,
				accountAlerts: true,
			});
			const on = await controller.getPreferences("cust-1");
			expect(on.orderUpdates).toBe(true);
			expect(on.promotions).toBe(true);
		});

		it("partial update preserves other existing values", async () => {
			await controller.updatePreferences("cust-1", {
				orderUpdates: false,
				promotions: false,
			});
			const updated = await controller.updatePreferences("cust-1", {
				promotions: true,
			});
			expect(updated.orderUpdates).toBe(false);
			expect(updated.promotions).toBe(true);
			expect(updated.shippingAlerts).toBe(true);
			expect(updated.accountAlerts).toBe(true);
		});

		it("different customers have independent preferences", async () => {
			await controller.updatePreferences("cust-1", {
				orderUpdates: false,
				promotions: false,
			});
			await controller.updatePreferences("cust-2", {
				shippingAlerts: false,
				accountAlerts: false,
			});

			const prefs1 = await controller.getPreferences("cust-1");
			const prefs2 = await controller.getPreferences("cust-2");

			expect(prefs1.orderUpdates).toBe(false);
			expect(prefs1.shippingAlerts).toBe(true);
			expect(prefs2.orderUpdates).toBe(true);
			expect(prefs2.shippingAlerts).toBe(false);
		});

		it("preserves id on multiple successive updates", async () => {
			const first = await controller.updatePreferences("cust-1", {
				promotions: false,
			});
			const second = await controller.updatePreferences("cust-1", {
				orderUpdates: false,
			});
			const third = await controller.updatePreferences("cust-1", {
				shippingAlerts: false,
			});
			expect(second.id).toBe(first.id);
			expect(third.id).toBe(first.id);
		});
	});

	// ── data store consistency ──────────────────────────────────────────

	describe("data store consistency", () => {
		it("notification store count matches expected items", async () => {
			await controller.create({
				customerId: "cust-1",
				title: "A",
				body: "a",
			});
			await controller.create({
				customerId: "cust-2",
				title: "B",
				body: "b",
			});
			expect(mockData.size("notification")).toBe(2);
		});

		it("preference store gets entry only after updatePreferences", async () => {
			expect(mockData.size("preference")).toBe(0);
			await controller.getPreferences("cust-1");
			expect(mockData.size("preference")).toBe(0);
			await controller.updatePreferences("cust-1", { promotions: false });
			expect(mockData.size("preference")).toBe(1);
		});

		it("notification and preference stores are independent", async () => {
			await controller.create({
				customerId: "cust-1",
				title: "Test",
				body: "body",
			});
			await controller.updatePreferences("cust-1", { promotions: false });
			expect(mockData.size("notification")).toBe(1);
			expect(mockData.size("preference")).toBe(1);
		});
	});

	// ── complex lifecycle scenarios ────────────────────────────────────

	describe("complex lifecycle scenarios", () => {
		it("create, update, markRead, then verify full state", async () => {
			const created = await controller.create({
				customerId: "cust-1",
				type: "order",
				title: "Order placed",
				body: "Your order has been placed",
				metadata: { orderId: "ord-1" },
			});
			await controller.update(created.id, {
				title: "Order confirmed",
				metadata: { orderId: "ord-1", confirmed: true },
			});
			await controller.markRead(created.id);

			const final = await controller.get(created.id);
			expect(final?.title).toBe("Order confirmed");
			expect(final?.body).toBe("Your order has been placed");
			expect(final?.metadata).toEqual({ orderId: "ord-1", confirmed: true });
			expect(final?.read).toBe(true);
			expect(final?.type).toBe("order");
		});

		it("multi-customer selective marking and deletion", async () => {
			const c1n1 = await controller.create({
				customerId: "cust-1",
				type: "order",
				title: "C1 Order",
				body: "a",
			});
			await controller.create({
				customerId: "cust-1",
				type: "shipping",
				title: "C1 Shipping",
				body: "b",
			});
			await controller.create({
				customerId: "cust-2",
				type: "order",
				title: "C2 Order",
				body: "c",
			});
			const c2n2 = await controller.create({
				customerId: "cust-2",
				type: "info",
				title: "C2 Info",
				body: "d",
			});

			await controller.markRead(c1n1.id);
			await controller.markRead(c2n2.id);

			expect(await controller.unreadCount("cust-1")).toBe(1);
			expect(await controller.unreadCount("cust-2")).toBe(1);

			await controller.delete(c1n1.id);
			// Deleting a read notification does not change unread count
			expect(await controller.unreadCount("cust-1")).toBe(1);

			const stats = await controller.getStats();
			expect(stats.total).toBe(3);
			expect(stats.unread).toBe(2);
		});

		it("markAllRead then create new shows correct unread count", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.create({
					customerId: "cust-1",
					title: `N${i}`,
					body: `b${i}`,
				});
			}
			await controller.markAllRead("cust-1");
			expect(await controller.unreadCount("cust-1")).toBe(0);

			await controller.create({
				customerId: "cust-1",
				title: "New",
				body: "new body",
			});
			expect(await controller.unreadCount("cust-1")).toBe(1);

			const stats = await controller.getStats();
			expect(stats.total).toBe(4);
			expect(stats.unread).toBe(1);
		});

		it("re-create after delete uses new id", async () => {
			const original = await controller.create({
				customerId: "cust-1",
				title: "Original",
				body: "body",
			});
			const originalId = original.id;
			await controller.delete(originalId);

			const recreated = await controller.create({
				customerId: "cust-1",
				title: "Original",
				body: "body",
			});
			expect(recreated.id).not.toBe(originalId);
		});

		it("preferences and notifications are independent features", async () => {
			await controller.create({
				customerId: "cust-1",
				title: "Test",
				body: "body",
			});
			await controller.updatePreferences("cust-1", { promotions: false });
			const promo = await controller.create({
				customerId: "cust-1",
				type: "promotion",
				title: "Sale",
				body: "50% off",
			});
			expect(promo.type).toBe("promotion");

			const prefs = await controller.getPreferences("cust-1");
			expect(prefs.promotions).toBe(false);
			expect(await controller.list({ customerId: "cust-1" })).toHaveLength(2);
		});
	});

	// ── boundary conditions ────────────────────────────────────────────

	describe("boundary conditions", () => {
		it("handles 100 notifications for a single customer", async () => {
			for (let i = 0; i < 100; i++) {
				await controller.create({
					customerId: "cust-1",
					title: `N${i}`,
					body: `b${i}`,
				});
			}
			expect(await controller.list({ customerId: "cust-1" })).toHaveLength(100);
			expect(await controller.unreadCount("cust-1")).toBe(100);
		});

		it("bulkDelete with 50 ids", async () => {
			const ids: string[] = [];
			for (let i = 0; i < 50; i++) {
				const n = await controller.create({
					customerId: "cust-1",
					title: `N${i}`,
					body: `b${i}`,
				});
				ids.push(n.id);
			}
			expect(await controller.bulkDelete(ids)).toBe(50);
			expect(await controller.list()).toHaveLength(0);
		});

		it("many customers with one notification each", async () => {
			for (let i = 0; i < 50; i++) {
				await controller.create({
					customerId: `cust-${i}`,
					title: `N${i}`,
					body: `b${i}`,
				});
			}
			const stats = await controller.getStats();
			expect(stats.total).toBe(50);
			expect(stats.unread).toBe(50);
		});
	});
});
