import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWaitlistController } from "../service-impl";

/**
 * Security tests for waitlist module endpoints.
 *
 * These tests verify:
 * - Product-scoped entries: operations stay isolated per product
 * - Duplicate signup prevention: idempotent subscribe per email+product
 * - Email isolation: one user's actions cannot affect another's entries
 * - Notification status integrity: status transitions are correct
 * - Position ordering: summary and listing correctness
 * - Cancel/purchase safety: only valid transitions are allowed
 */

describe("waitlist endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWaitlistController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWaitlistController(mockData);
	});

	// ── Product-Scoped Entry Isolation ─────────────────────────────

	describe("product-scoped entry isolation", () => {
		it("entries for product A are not returned when listing product B", async () => {
			await controller.subscribe({
				productId: "prod_a",
				productName: "Product A",
				email: "user@test.com",
			});
			await controller.subscribe({
				productId: "prod_b",
				productName: "Product B",
				email: "user@test.com",
			});

			const entriesA = await controller.listByProduct("prod_a");
			const entriesB = await controller.listByProduct("prod_b");

			expect(entriesA.every((e) => e.productId === "prod_a")).toBe(true);
			expect(entriesB.every((e) => e.productId === "prod_b")).toBe(true);
		});

		it("markNotified only affects the targeted product", async () => {
			await controller.subscribe({
				productId: "prod_a",
				productName: "A",
				email: "alice@test.com",
			});
			await controller.subscribe({
				productId: "prod_b",
				productName: "B",
				email: "bob@test.com",
			});

			await controller.markNotified("prod_a");

			const entriesB = await controller.listByProduct("prod_b");
			expect(entriesB[0]?.status).toBe("waiting");
		});

		it("countByProduct does not include entries from other products", async () => {
			await controller.subscribe({
				productId: "prod_a",
				productName: "A",
				email: "alice@test.com",
			});
			await controller.subscribe({
				productId: "prod_a",
				productName: "A",
				email: "bob@test.com",
			});
			await controller.subscribe({
				productId: "prod_b",
				productName: "B",
				email: "carol@test.com",
			});

			const countA = await controller.countByProduct("prod_a");
			const countB = await controller.countByProduct("prod_b");
			expect(countA).toBe(2);
			expect(countB).toBe(1);
		});
	});

	// ── Duplicate Signup Prevention ────────────────────────────────

	describe("duplicate signup prevention", () => {
		it("duplicate subscribe for same email+product returns the existing entry", async () => {
			const first = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "dup@test.com",
			});
			const second = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "dup@test.com",
			});

			expect(second.id).toBe(first.id);
			expect(second.status).toBe("waiting");
		});

		it("duplicate subscribe does not inflate the waitlist count", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "dup@test.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "dup@test.com",
			});

			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(1);
		});

		it("same email can subscribe to different products independently", async () => {
			const e1 = await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "user@test.com",
			});
			const e2 = await controller.subscribe({
				productId: "prod_2",
				productName: "B",
				email: "user@test.com",
			});

			expect(e1.id).not.toBe(e2.id);
			const byEmail = await controller.listByEmail("user@test.com");
			expect(byEmail).toHaveLength(2);
		});

		it("re-subscribing after cancellation creates a new entry", async () => {
			const original = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@test.com",
			});
			await controller.cancelByEmail("user@test.com", "prod_1");

			const renewed = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@test.com",
			});

			expect(renewed.id).not.toBe(original.id);
			expect(renewed.status).toBe("waiting");
		});
	});

	// ── Email Isolation ────────────────────────────────────────────

	describe("email isolation", () => {
		it("cancelling one email does not affect another email on the same product", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@test.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "bob@test.com",
			});

			await controller.cancelByEmail("alice@test.com", "prod_1");

			const bobSubscribed = await controller.isSubscribed(
				"bob@test.com",
				"prod_1",
			);
			expect(bobSubscribed).toBe(true);
		});

		it("listByEmail returns only entries for that specific email", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@test.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "B",
				email: "bob@test.com",
			});

			const aliceEntries = await controller.listByEmail("alice@test.com");
			expect(aliceEntries).toHaveLength(1);
			expect(aliceEntries.every((e) => e.email === "alice@test.com")).toBe(
				true,
			);
		});

		it("markPurchased for one email does not affect another email", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@test.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "bob@test.com",
			});

			await controller.markPurchased("alice@test.com", "prod_1");

			const bobSubscribed = await controller.isSubscribed(
				"bob@test.com",
				"prod_1",
			);
			expect(bobSubscribed).toBe(true);
		});

		it("unsubscribing by ID only removes the targeted entry", async () => {
			const alice = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@test.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "bob@test.com",
			});

			await controller.unsubscribe(alice.id);

			const remaining = await controller.listByProduct("prod_1");
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.email).toBe("bob@test.com");
		});
	});

	// ── Notification Status Integrity ──────────────────────────────

	describe("notification status integrity", () => {
		it("markNotified sets notifiedAt timestamp on all affected entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@test.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "bob@test.com",
			});

			await controller.markNotified("prod_1");

			const entries = await controller.listByProduct("prod_1");
			for (const entry of entries) {
				expect(entry.status).toBe("notified");
				expect(entry.notifiedAt).toBeDefined();
			}
		});

		it("markNotified returns 0 when called again (no double notification)", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@test.com",
			});

			const first = await controller.markNotified("prod_1");
			expect(first).toBe(1);

			const second = await controller.markNotified("prod_1");
			expect(second).toBe(0);
		});

		it("cancelByEmail does not cancel already-notified entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@test.com",
			});
			await controller.markNotified("prod_1");

			const result = await controller.cancelByEmail("alice@test.com", "prod_1");
			expect(result).toBe(false);
		});

		it("markPurchased transitions both waiting and notified entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@test.com",
			});

			// Mark as notified first
			await controller.markNotified("prod_1");
			const result = await controller.markPurchased("alice@test.com", "prod_1");
			expect(result).toBe(true);

			const entries = await controller.listAll({
				email: "alice@test.com",
				productId: "prod_1",
			});
			expect(entries[0]?.status).toBe("purchased");
		});

		it("markPurchased does not transition cancelled entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@test.com",
			});
			await controller.cancelByEmail("alice@test.com", "prod_1");

			const result = await controller.markPurchased("alice@test.com", "prod_1");
			expect(result).toBe(false);
		});
	});

	// ── Summary Accuracy ───────────────────────────────────────────

	describe("summary accuracy and ordering", () => {
		it("summary only counts waiting entries in topProducts", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@test.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "bob@test.com",
			});
			// Notify all entries for prod_1
			await controller.markNotified("prod_1");

			const summary = await controller.getSummary();
			// Notified entries should not appear in topProducts
			expect(summary.topProducts).toHaveLength(0);
			expect(summary.totalNotified).toBe(2);
			expect(summary.totalWaiting).toBe(0);
		});

		it("summary ranks products by descending waitlist count", async () => {
			// prod_popular: 3 entries, prod_niche: 1 entry
			for (let i = 0; i < 3; i++) {
				await controller.subscribe({
					productId: "prod_popular",
					productName: "Popular Widget",
					email: `user${i}@test.com`,
				});
			}
			await controller.subscribe({
				productId: "prod_niche",
				productName: "Niche Widget",
				email: "solo@test.com",
			});

			const summary = await controller.getSummary();
			expect(summary.topProducts.length).toBeGreaterThanOrEqual(2);
			expect(summary.topProducts[0]?.productId).toBe("prod_popular");
			expect(summary.topProducts[0]?.count).toBe(3);
			expect(summary.topProducts[1]?.productId).toBe("prod_niche");
			expect(summary.topProducts[1]?.count).toBe(1);
		});

		it("summary excludes purchased and cancelled from waiting count", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@test.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "bob@test.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "carol@test.com",
			});

			await controller.cancelByEmail("alice@test.com", "prod_1");
			await controller.markPurchased("bob@test.com", "prod_1");

			const summary = await controller.getSummary();
			expect(summary.totalWaiting).toBe(1);
		});
	});

	// ── Non-Existent Resource Safety ───────────────────────────────

	describe("non-existent resource safety", () => {
		it("getEntry returns null for unknown ID", async () => {
			const entry = await controller.getEntry("nonexistent-id");
			expect(entry).toBeNull();
		});

		it("unsubscribe returns false for unknown ID", async () => {
			const result = await controller.unsubscribe("nonexistent-id");
			expect(result).toBe(false);
		});

		it("isSubscribed returns false for unknown email+product pair", async () => {
			const result = await controller.isSubscribed(
				"ghost@test.com",
				"prod_nonexistent",
			);
			expect(result).toBe(false);
		});

		it("markPurchased returns false for unknown email+product pair", async () => {
			const result = await controller.markPurchased(
				"ghost@test.com",
				"prod_nonexistent",
			);
			expect(result).toBe(false);
		});

		it("markNotified returns 0 for product with no waiting entries", async () => {
			const count = await controller.markNotified("prod_nonexistent");
			expect(count).toBe(0);
		});
	});
});
