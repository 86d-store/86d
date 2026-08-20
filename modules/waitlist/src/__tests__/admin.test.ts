import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWaitlistController } from "../service-impl";

/**
 * Admin workflow and edge-case tests for the waitlist module.
 *
 * Covers: subscribe/unsubscribe flows, duplicate prevention, notification
 * marking, purchase tracking, listing, summary analytics, multi-product
 * isolation, and email-based queries.
 */

describe("waitlist — admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWaitlistController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWaitlistController(mockData);
	});

	// ── Subscribe ──────────────────────────────────────────────────

	describe("subscribe", () => {
		it("creates a new waitlist entry", async () => {
			const entry = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			expect(entry.id).toBeDefined();
			expect(entry.productId).toBe("prod_1");
			expect(entry.email).toBe("user@example.com");
			expect(entry.status).toBe("waiting");
		});

		it("preserves optional fields", async () => {
			const entry = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
				variantId: "var_blue",
				variantLabel: "Blue, Large",
				customerId: "cust_1",
			});
			expect(entry.variantId).toBe("var_blue");
			expect(entry.variantLabel).toBe("Blue, Large");
			expect(entry.customerId).toBe("cust_1");
		});

		it("returns existing entry for duplicate subscription", async () => {
			const first = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			const second = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			expect(first.id).toBe(second.id);
		});

		it("allows same email for different products", async () => {
			const e1 = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			const e2 = await controller.subscribe({
				productId: "prod_2",
				productName: "Gadget",
				email: "user@example.com",
			});
			expect(e1.id).not.toBe(e2.id);
		});

		it("allows same product for different emails", async () => {
			const e1 = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@example.com",
			});
			const e2 = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "bob@example.com",
			});
			expect(e1.id).not.toBe(e2.id);
		});
	});

	// ── Unsubscribe ────────────────────────────────────────────────

	describe("unsubscribe", () => {
		it("removes an entry by id", async () => {
			const entry = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			const result = await controller.unsubscribe(entry.id);
			expect(result).toBe(true);
			const fetched = await controller.getEntry(entry.id);
			expect(fetched).toBeNull();
		});

		it("returns false for non-existent entry", async () => {
			const result = await controller.unsubscribe("fake-id");
			expect(result).toBe(false);
		});
	});

	// ── Cancel by email ────────────────────────────────────────────

	describe("cancelByEmail", () => {
		it("cancels waiting entries for email+product", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			const result = await controller.cancelByEmail(
				"user@example.com",
				"prod_1",
			);
			expect(result).toBe(true);
		});

		it("returns false if no matching waiting entries", async () => {
			const result = await controller.cancelByEmail(
				"nobody@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});

		it("cancelled entries are not returned as duplicates", async () => {
			const original = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			await controller.cancelByEmail("user@example.com", "prod_1");

			// Re-subscribing should create a new entry (original is cancelled)
			const resubscribed = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			expect(resubscribed.id).not.toBe(original.id);
		});
	});

	// ── isSubscribed ───────────────────────────────────────────────

	describe("isSubscribed", () => {
		it("returns true for active subscription", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			const result = await controller.isSubscribed(
				"user@example.com",
				"prod_1",
			);
			expect(result).toBe(true);
		});

		it("returns false for non-subscriber", async () => {
			const result = await controller.isSubscribed(
				"user@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});

		it("returns false after cancellation", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			await controller.cancelByEmail("user@example.com", "prod_1");
			const result = await controller.isSubscribed(
				"user@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});
	});

	// ── Mark notified ──────────────────────────────────────────────

	describe("markNotified", () => {
		it("marks all waiting entries for a product as notified", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "bob@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "carol@example.com",
			});

			const count = await controller.markNotified("prod_1");
			expect(count).toBe(3);
		});

		it("returns 0 for product with no waiting entries", async () => {
			const count = await controller.markNotified("prod_nonexistent");
			expect(count).toBe(0);
		});

		it("does not re-mark already notified entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			await controller.markNotified("prod_1");

			// Second call should find 0 waiting entries
			const count = await controller.markNotified("prod_1");
			expect(count).toBe(0);
		});

		it("only marks entries for the specified product", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "Gadget",
				email: "user@example.com",
			});

			await controller.markNotified("prod_1");

			// prod_2 should still have waiting entries
			expect(await controller.isSubscribed("user@example.com", "prod_2")).toBe(
				true,
			);
		});

		it("sets notifiedAt timestamp", async () => {
			const entry = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			await controller.markNotified("prod_1");

			const entries = await controller.listByProduct("prod_1", {});
			const notified = entries.find((e) => e.id === entry.id);
			expect(notified?.status).toBe("notified");
			expect(notified?.notifiedAt).toBeInstanceOf(Date);
		});
	});

	// ── Mark purchased ─────────────────────────────────────────────

	describe("markPurchased", () => {
		it("marks waiting entry as purchased", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			const result = await controller.markPurchased(
				"user@example.com",
				"prod_1",
			);
			expect(result).toBe(true);
		});

		it("marks notified entry as purchased", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			await controller.markNotified("prod_1");
			const result = await controller.markPurchased(
				"user@example.com",
				"prod_1",
			);
			expect(result).toBe(true);
		});

		it("returns false if no active entries exist", async () => {
			const result = await controller.markPurchased(
				"nobody@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});

		it("returns false for already purchased entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			await controller.markPurchased("user@example.com", "prod_1");
			const result = await controller.markPurchased(
				"user@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});

		it("does not mark cancelled entries as purchased", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			await controller.cancelByEmail("user@example.com", "prod_1");
			const result = await controller.markPurchased(
				"user@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});
	});

	// ── Listing ────────────────────────────────────────────────────

	describe("listing", () => {
		it("lists entries by product", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "a@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "b@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "Gadget",
				email: "c@example.com",
			});

			const entries = await controller.listByProduct("prod_1", {});
			expect(entries).toHaveLength(2);
		});

		it("lists entries by product with status filter", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "a@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "b@example.com",
			});
			await controller.markPurchased("a@example.com", "prod_1");

			const waiting = await controller.listByProduct("prod_1", {
				status: "waiting",
			});
			expect(waiting).toHaveLength(1);
			expect(waiting[0].email).toBe("b@example.com");
		});

		it("lists entries by email", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "Gadget",
				email: "user@example.com",
			});

			const entries = await controller.listByEmail("user@example.com", {});
			expect(entries).toHaveLength(2);
		});

		it("lists all entries with filters", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "a@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "Gadget",
				email: "b@example.com",
			});

			const all = await controller.listAll({});
			expect(all).toHaveLength(2);

			const byProduct = await controller.listAll({ productId: "prod_1" });
			expect(byProduct).toHaveLength(1);

			const byEmail = await controller.listAll({ email: "b@example.com" });
			expect(byEmail).toHaveLength(1);
		});

		it("paginates results", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.subscribe({
					productId: "prod_1",
					productName: "Widget",
					email: `user${i}@example.com`,
				});
			}
			const page = await controller.listByProduct("prod_1", {
				take: 3,
				skip: 2,
			});
			expect(page).toHaveLength(3);
		});
	});

	// ── Count by product ───────────────────────────────────────────

	describe("countByProduct", () => {
		it("counts only waiting entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "a@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "b@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "c@example.com",
			});
			await controller.markPurchased("c@example.com", "prod_1");

			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(2);
		});

		it("returns 0 for product with no waitlist", async () => {
			const count = await controller.countByProduct("prod_nonexistent");
			expect(count).toBe(0);
		});
	});

	// ── Summary analytics ──────────────────────────────────────────

	describe("summary analytics", () => {
		it("returns zeros on empty database", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalWaiting).toBe(0);
			expect(summary.totalNotified).toBe(0);
			expect(summary.topProducts).toHaveLength(0);
		});

		it("counts waiting and notified separately", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "a@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "b@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "Gadget",
				email: "c@example.com",
			});
			await controller.markNotified("prod_2");

			const summary = await controller.getSummary();
			expect(summary.totalWaiting).toBe(2);
			expect(summary.totalNotified).toBe(1);
		});

		it("top products are sorted by waiting count descending", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.subscribe({
					productId: "prod_popular",
					productName: "Popular",
					email: `user${i}@example.com`,
				});
			}
			for (let i = 0; i < 2; i++) {
				await controller.subscribe({
					productId: "prod_niche",
					productName: "Niche",
					email: `niche${i}@example.com`,
				});
			}

			const summary = await controller.getSummary();
			expect(summary.topProducts[0].productId).toBe("prod_popular");
			expect(summary.topProducts[0].count).toBe(5);
			expect(summary.topProducts[1].productId).toBe("prod_niche");
			expect(summary.topProducts[1].count).toBe(2);
		});

		it("top products excludes non-waiting entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			await controller.markPurchased("user@example.com", "prod_1");

			const summary = await controller.getSummary();
			expect(summary.topProducts).toHaveLength(0);
		});

		it("top products caps at 10 items", async () => {
			for (let i = 0; i < 15; i++) {
				await controller.subscribe({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
					email: `user@example.com`,
				});
			}

			const summary = await controller.getSummary();
			expect(summary.topProducts.length).toBeLessThanOrEqual(10);
		});
	});

	// ── getEntry ───────────────────────────────────────────────────

	describe("getEntry", () => {
		it("returns entry by id", async () => {
			const created = await controller.subscribe({
				productId: "prod_1",
				productName: "Widget",
				email: "user@example.com",
			});
			const fetched = await controller.getEntry(created.id);
			expect(fetched?.email).toBe("user@example.com");
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.getEntry("fake-id");
			expect(result).toBeNull();
		});
	});
});
