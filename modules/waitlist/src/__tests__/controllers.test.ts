import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWaitlistController } from "../service-impl";

describe("waitlist controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWaitlistController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWaitlistController(mockData);
	});

	// ── Subscribe edge cases ─────────────────────────────────────────

	describe("subscribe — edge cases", () => {
		it("creates new entry after previous was purchased", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			await controller.markPurchased("alice@example.com", "prod_1");

			const entry = await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			expect(entry.status).toBe("waiting");
		});

		it("creates new entry after previous was notified", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			await controller.markNotified("prod_1");

			// Notified entries don't match the idempotency check (status != "waiting")
			const entry = await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			expect(entry.status).toBe("waiting");
		});

		it("each entry gets a unique ID", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 5; i++) {
				const entry = await controller.subscribe({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
					email: "alice@example.com",
				});
				ids.add(entry.id);
			}
			expect(ids.size).toBe(5);
		});
	});

	// ── listAll combined filters ─────────────────────────────────────

	describe("listAll — combined filters", () => {
		it("filters by productId + status", async () => {
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
			await controller.markNotified("prod_1");

			const result = await controller.listAll({
				productId: "prod_1",
				status: "notified",
			});
			expect(result).toHaveLength(2);
		});

		it("filters by email + status", async () => {
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
			await controller.markNotified("prod_1");

			const result = await controller.listAll({
				email: "alice@example.com",
				status: "waiting",
			});
			expect(result).toHaveLength(1);
			expect(result[0].productId).toBe("prod_2");
		});

		it("supports pagination on listAll", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.subscribe({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
					email: "alice@example.com",
				});
			}

			const page = await controller.listAll({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// ── listByEmail pagination ───────────────────────────────────────

	describe("listByEmail — pagination", () => {
		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.subscribe({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
					email: "alice@example.com",
				});
			}

			const page = await controller.listByEmail("alice@example.com", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── markPurchased edge cases ─────────────────────────────────────

	describe("markPurchased — edge cases", () => {
		it("returns false for already-purchased entry", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			await controller.markPurchased("alice@example.com", "prod_1");

			const result = await controller.markPurchased(
				"alice@example.com",
				"prod_1",
			);
			expect(result).toBe(false);
		});

		it("marks multiple active entries (waiting + notified) as purchased", async () => {
			// Create two entries for same email/product via different flow
			await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});
			// Notify it
			await controller.markNotified("prod_1");

			// Create another entry (new subscribe after notification)
			await controller.subscribe({
				productId: "prod_1",
				productName: "Test",
				email: "alice@example.com",
			});

			const result = await controller.markPurchased(
				"alice@example.com",
				"prod_1",
			);
			expect(result).toBe(true);

			const entries = await controller.listAll({
				email: "alice@example.com",
				productId: "prod_1",
			});
			// All active (waiting/notified) should be purchased
			const activeEntries = entries.filter(
				(e) => e.status === "waiting" || e.status === "notified",
			);
			expect(activeEntries).toHaveLength(0);
		});
	});

	// ── markNotified edge cases ──────────────────────────────────────

	describe("markNotified — edge cases", () => {
		it("sets notifiedAt timestamp", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.markNotified("prod_1");

			const entries = await controller.listByProduct("prod_1");
			expect(entries[0].notifiedAt).toBeDefined();
		});

		it("only notifies waiting entries, not cancelled", async () => {
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
			await controller.cancelByEmail("bob@example.com", "prod_1");

			const count = await controller.markNotified("prod_1");
			expect(count).toBe(1);
		});
	});

	// ── getSummary edge cases ────────────────────────────────────────

	describe("getSummary — edge cases", () => {
		it("does not count cancelled entries in topProducts", async () => {
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
			await controller.cancelByEmail("bob@example.com", "prod_1");

			const summary = await controller.getSummary();
			expect(summary.totalWaiting).toBe(1);
			expect(summary.topProducts[0].count).toBe(1);
		});

		it("does not count purchased entries in topProducts", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "Product",
				email: "alice@example.com",
			});
			await controller.markPurchased("alice@example.com", "prod_1");

			const summary = await controller.getSummary();
			expect(summary.totalWaiting).toBe(0);
			expect(summary.topProducts).toHaveLength(0);
		});

		it("summary with many products for top 10 limit", async () => {
			for (let i = 0; i < 15; i++) {
				// Each product gets a different number of entries
				for (let j = 0; j <= i % 3; j++) {
					await controller.subscribe({
						productId: `prod_${i}`,
						productName: `Product ${i}`,
						email: `user${i}_${j}@example.com`,
					});
				}
			}

			const summary = await controller.getSummary();
			expect(summary.topProducts.length).toBeLessThanOrEqual(10);
			// Verify sorted descending by count
			for (let i = 1; i < summary.topProducts.length; i++) {
				expect(summary.topProducts[i - 1].count).toBeGreaterThanOrEqual(
					summary.topProducts[i].count,
				);
			}
		});
	});

	// ── countByProduct edge cases ────────────────────────────────────

	describe("countByProduct — edge cases", () => {
		it("does not count cancelled entries", async () => {
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
			await controller.cancelByEmail("bob@example.com", "prod_1");

			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(1);
		});

		it("does not count purchased entries", async () => {
			await controller.subscribe({
				productId: "prod_1",
				productName: "A",
				email: "alice@example.com",
			});
			await controller.markPurchased("alice@example.com", "prod_1");

			const count = await controller.countByProduct("prod_1");
			expect(count).toBe(0);
		});
	});
});
