import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWaitlistController } from "../service-impl";

describe("createWaitlistController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWaitlistController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWaitlistController(mockData);
	});

	// ── subscribe ─────────────────────────────────────────────────────────

	describe("subscribe", () => {
		it("creates a new waitlist entry", async () => {
			const entry = await controller.subscribe({
				productId: "prod_1",
				productName: "Test Product",
				email: "alice@example.com",
			});
			expect(entry.id).toBeDefined();
			expect(entry.productId).toBe("prod_1");
			expect(entry.productName).toBe("Test Product");
			expect(entry.email).toBe("alice@example.com");
			expect(entry.status).toBe("waiting");
			expect(entry.createdAt).toBeInstanceOf(Date);
		});

		it("stores optional variant fields", async () => {
			const entry = await controller.subscribe({
				productId: "prod_1",
				productName: "T-Shirt",
				variantId: "var_xl_red",
				variantLabel: "XL / Red",
				email: "bob@example.com",
			});
			expect(entry.variantId).toBe("var_xl_red");
			expect(entry.variantLabel).toBe("XL / Red");
		});

		it("stores optional customerId", async () => {
			const entry = await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
				customerId: "cust_1",
			});
			expect(entry.customerId).toBe("cust_1");
		});

		it("returns existing entry on duplicate (idempotent)", async () => {
			const first = await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			const second = await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			expect(second.id).toBe(first.id);
		});

		it("allows same product for different emails", async () => {
			const entry1 = await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			const entry2 = await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "bob@example.com",
			});
			expect(entry1.id).not.toBe(entry2.id);
		});

		it("allows same email for different products", async () => {
			const entry1 = await controller.subscribe({
				productId: "prod_1",
				productName: "Product A",
				email: "alice@example.com",
			});
			const entry2 = await controller.subscribe({
				productId: "prod_2",
				productName: "Product B",
				email: "alice@example.com",
			});
			expect(entry1.id).not.toBe(entry2.id);
		});

		it("creates new entry if previous was cancelled", async () => {
			const first = await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			await controller.cancelByEmail("alice@example.com", "prod_1");
			const second = await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			expect(second.id).not.toBe(first.id);
			expect(second.status).toBe("waiting");
		});
	});

	// ── unsubscribe ───────────────────────────────────────────────────────

	describe("unsubscribe", () => {
		it("removes an existing entry", async () => {
			const entry = await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			const result = await controller.unsubscribe(entry.id);
			expect(result).toBe(true);
			const found = await controller.getEntry(entry.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent entry", async () => {
			const result = await controller.unsubscribe("missing");
			expect(result).toBe(false);
		});
	});

	// ── cancelByEmail ─────────────────────────────────────────────────────

	describe("cancelByEmail", () => {
		it("cancels a waiting entry by email and product", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			const result = await controller.cancelByEmail(
				"alice@example.com",
				"prod_1",
			);
			expect(result).toBe(true);
			const subscribed = await controller.isSubscribed(
				"alice@example.com",
				"prod_1",
			);
			expect(subscribed).toBe(false);
		});

		it("returns false when not subscribed", async () => {
			const result = await controller.cancelByEmail(
				"alice@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});

		it("does not cancel already-notified entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			await controller.markNotified("prod_1");
			const result = await controller.cancelByEmail(
				"alice@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});
	});

	// ── getEntry ──────────────────────────────────────────────────────────

	describe("getEntry", () => {
		it("returns an existing entry", async () => {
			const created = await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			const found = await controller.getEntry(created.id);
			expect(found?.productId).toBe("prod_1");
			expect(found?.email).toBe("alice@example.com");
		});

		it("returns null for non-existent entry", async () => {
			const found = await controller.getEntry("missing");
			expect(found).toBeNull();
		});
	});

	// ── isSubscribed ──────────────────────────────────────────────────────

	describe("isSubscribed", () => {
		it("returns true when actively waiting", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			const result = await controller.isSubscribed(
				"alice@example.com",
				"prod_1",
			);
			expect(result).toBe(true);
		});

		it("returns false when not subscribed", async () => {
			const result = await controller.isSubscribed(
				"alice@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});

		it("returns false after cancellation", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			await controller.cancelByEmail("alice@example.com", "prod_1");
			const result = await controller.isSubscribed(
				"alice@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});
	});

	// ── listByProduct ─────────────────────────────────────────────────────

	describe("listByProduct", () => {
		it("lists entries for a specific product", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "bob@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "B",
				email: "carol@example.com",
			});
			const entries = await controller.listByProduct("prod_1");
			expect(entries).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "bob@example.com",
			});
			await controller.markNotified("prod_1");

			const waiting = await controller.listByProduct("prod_1", {
				status: "waiting",
			});
			expect(waiting).toHaveLength(0);

			const notified = await controller.listByProduct("prod_1", {
				status: "notified",
			});
			expect(notified).toHaveLength(2);
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.subscribe({
					productId: "prod_1",
					productName: "A",
					email: `user${i}@example.com`,
				});
			}
			const page = await controller.listByProduct("prod_1", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty array for product with no entries", async () => {
			const entries = await controller.listByProduct("prod_nonexistent");
			expect(entries).toHaveLength(0);
		});
	});

	// ── listByEmail ───────────────────────────────────────────────────────

	describe("listByEmail", () => {
		it("lists all entries for an email", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "B",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_3",
				productName: "C",
				email: "bob@example.com",
			});
			const entries = await controller.listByEmail("alice@example.com");
			expect(entries).toHaveLength(2);
		});

		it("returns empty array for email with no entries", async () => {
			const entries = await controller.listByEmail("nobody@example.com");
			expect(entries).toHaveLength(0);
		});
	});

	// ── listAll ───────────────────────────────────────────────────────────

	describe("listAll", () => {
		it("lists all waitlist entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "B",
				email: "bob@example.com",
			});
			const all = await controller.listAll();
			expect(all).toHaveLength(2);
		});

		it("filters by productId", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "B",
				email: "bob@example.com",
			});
			const result = await controller.listAll({ productId: "prod_1" });
			expect(result).toHaveLength(1);
		});

		it("filters by email", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "B",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_3",
				productName: "C",
				email: "bob@example.com",
			});
			const result = await controller.listAll({ email: "alice@example.com" });
			expect(result).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "B",
				email: "bob@example.com",
			});
			await controller.markNotified("prod_1");

			const waiting = await controller.listAll({ status: "waiting" });
			expect(waiting).toHaveLength(1);
			expect(waiting[0].productId).toBe("prod_2");

			const notified = await controller.listAll({ status: "notified" });
			expect(notified).toHaveLength(1);
			expect(notified[0].productId).toBe("prod_1");
		});
	});

	// ── countByProduct ────────────────────────────────────────────────────

	describe("countByProduct", () => {
		it("counts waiting entries for a product", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "bob@example.com",
			});
			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(2);
		});

		it("returns 0 for product with no entries", async () => {
			const count = await controller.countByProduct("prod_none");
			expect(count).toBe(0);
		});

		it("only counts waiting entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "bob@example.com",
			});
			await controller.markNotified("prod_1");
			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(0);
		});
	});

	// ── markNotified ──────────────────────────────────────────────────────

	describe("markNotified", () => {
		it("marks all waiting entries for a product as notified", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "bob@example.com",
			});
			const count = await controller.markNotified("prod_1");
			expect(count).toBe(2);

			const entries = await controller.listByProduct("prod_1");
			for (const entry of entries) {
				expect(entry.status).toBe("notified");
				expect(entry.notifiedAt).toBeDefined();
			}
		});

		it("returns 0 when no waiting entries exist", async () => {
			const count = await controller.markNotified("prod_nonexistent");
			expect(count).toBe(0);
		});

		it("does not affect entries for other products", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "B",
				email: "bob@example.com",
			});
			await controller.markNotified("prod_1");

			const prod2Entries = await controller.listByProduct("prod_2");
			expect(prod2Entries[0].status).toBe("waiting");
		});

		it("does not double-notify already-notified entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.markNotified("prod_1");
			const count = await controller.markNotified("prod_1");
			expect(count).toBe(0);
		});
	});

	// ── markPurchased ─────────────────────────────────────────────────────

	describe("markPurchased", () => {
		it("marks entry as purchased for email + product", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			const result = await controller.markPurchased(
				"alice@example.com",
				"prod_1",
			);
			expect(result).toBe(true);

			const entry = (
				await controller.listAll({ email: "alice@example.com" })
			)[0];
			expect(entry.status).toBe("purchased");
		});

		it("marks notified entry as purchased", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.markNotified("prod_1");
			const result = await controller.markPurchased(
				"alice@example.com",
				"prod_1",
			);
			expect(result).toBe(true);
		});

		it("returns false for non-existent entry", async () => {
			const result = await controller.markPurchased(
				"nobody@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});

		it("does not mark already-cancelled entry", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.cancelByEmail("alice@example.com", "prod_1");
			const result = await controller.markPurchased(
				"alice@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});
	});

	// ── getSummary ────────────────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns summary with totals and top products", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Popular",
				email: "alice@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Popular",
				email: "bob@example.com",
			});
			await controller.subscribe({
				productId: "prod_1",
				productName: "Popular",
				email: "carol@example.com",
			});
			await controller.subscribe({
				productId: "prod_2",
				productName: "Other",
				email: "dave@example.com",
			});
			// Notify prod_2 so it becomes "notified"
			await controller.markNotified("prod_2");

			const summary = await controller.getSummary();
			expect(summary.totalWaiting).toBe(3);
			expect(summary.totalNotified).toBe(1);
			expect(summary.topProducts).toHaveLength(1); // only waiting products
			expect(summary.topProducts[0].productId).toBe("prod_1");
			expect(summary.topProducts[0].count).toBe(3);
		});

		it("returns empty summary when no entries", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalWaiting).toBe(0);
			expect(summary.totalNotified).toBe(0);
			expect(summary.topProducts).toHaveLength(0);
		});

		it("limits top products to 10", async () => {
			for (let i = 0; i < 15; i++) {
				await controller.subscribe({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
					email: `user${i}@example.com`,
				});
			}
			const summary = await controller.getSummary();
			expect(summary.topProducts.length).toBeLessThanOrEqual(10);
		});

		it("ranks top products by count descending", async () => {
			// prod_1: 3 entries, prod_2: 1 entry
			for (let i = 0; i < 3; i++) {
				await controller.subscribe({
					productId: "prod_1",
					productName: "Popular",
					email: `pop${i}@example.com`,
				});
			}
			await controller.subscribe({
				productId: "prod_2",
				productName: "Less Popular",
				email: "solo@example.com",
			});

			const summary = await controller.getSummary();
			expect(summary.topProducts[0].productId).toBe("prod_1");
			expect(summary.topProducts[0].count).toBe(3);
			expect(summary.topProducts[1].productId).toBe("prod_2");
			expect(summary.topProducts[1].count).toBe(1);
		});
	});
});
