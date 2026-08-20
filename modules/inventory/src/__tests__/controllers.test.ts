import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createInventoryController } from "../service-impl";

// ── Edge cases and data integrity tests ──────────────────────────────────

describe("inventory controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createInventoryController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createInventoryController(mockData);
	});

	// ── setStock / getStock — variant and location isolation ────────

	describe("setStock — variant and location isolation", () => {
		it("same product different variants are tracked independently", async () => {
			await controller.setStock({
				productId: "p1",
				variantId: "red",
				quantity: 10,
			});
			await controller.setStock({
				productId: "p1",
				variantId: "blue",
				quantity: 5,
			});

			const red = await controller.getStock({
				productId: "p1",
				variantId: "red",
			});
			const blue = await controller.getStock({
				productId: "p1",
				variantId: "blue",
			});
			expect(red?.quantity).toBe(10);
			expect(blue?.quantity).toBe(5);
		});

		it("same product different locations are tracked independently", async () => {
			await controller.setStock({
				productId: "p1",
				locationId: "warehouse-a",
				quantity: 20,
			});
			await controller.setStock({
				productId: "p1",
				locationId: "warehouse-b",
				quantity: 8,
			});

			const a = await controller.getStock({
				productId: "p1",
				locationId: "warehouse-a",
			});
			const b = await controller.getStock({
				productId: "p1",
				locationId: "warehouse-b",
			});
			expect(a?.quantity).toBe(20);
			expect(b?.quantity).toBe(8);
		});

		it("setStock preserves reserved count on update", async () => {
			await controller.setStock({ productId: "p1", quantity: 20 });
			await controller.reserve({ productId: "p1", quantity: 5 });

			// Update stock — reserved should be preserved
			const updated = await controller.setStock({
				productId: "p1",
				quantity: 30,
			});
			expect(updated.quantity).toBe(30);
			expect(updated.reserved).toBe(5);
			expect(updated.available).toBe(25);
		});

		it("setStock preserves createdAt on update", async () => {
			const initial = await controller.setStock({
				productId: "p1",
				quantity: 10,
			});
			const originalCreatedAt = initial.createdAt.getTime();

			await new Promise((r) => setTimeout(r, 5));

			const updated = await controller.setStock({
				productId: "p1",
				quantity: 20,
			});
			expect(updated.createdAt.getTime()).toBe(originalCreatedAt);
		});

		it("setStock to zero quantity is valid", async () => {
			await controller.setStock({ productId: "p1", quantity: 10 });
			const result = await controller.setStock({
				productId: "p1",
				quantity: 0,
			});
			expect(result.quantity).toBe(0);
			expect(result.available).toBe(0);
		});
	});

	// ── adjustStock — boundary conditions ───────────────────────────

	describe("adjustStock — boundary conditions", () => {
		it("negative adjustment floors at zero", async () => {
			await controller.setStock({ productId: "p1", quantity: 3 });
			const result = await controller.adjustStock({
				productId: "p1",
				delta: -10,
			});
			expect(result?.quantity).toBe(0);
		});

		it("zero delta is a no-op (quantity unchanged)", async () => {
			await controller.setStock({ productId: "p1", quantity: 15 });
			const result = await controller.adjustStock({
				productId: "p1",
				delta: 0,
			});
			expect(result?.quantity).toBe(15);
		});

		it("adjustStock preserves reserved count", async () => {
			await controller.setStock({ productId: "p1", quantity: 10 });
			await controller.reserve({ productId: "p1", quantity: 3 });
			const result = await controller.adjustStock({
				productId: "p1",
				delta: 5,
			});
			expect(result?.quantity).toBe(15);
			expect(result?.reserved).toBe(3);
			expect(result?.available).toBe(12);
		});

		it("returns null for non-existent product", async () => {
			const result = await controller.adjustStock({
				productId: "nonexistent",
				delta: 5,
			});
			expect(result).toBeNull();
		});
	});

	// ── reserve — backorder and edge cases ──────────────────────────

	describe("reserve — backorder and edge cases", () => {
		it("rejects reservation when insufficient stock and no backorder", async () => {
			await controller.setStock({ productId: "p1", quantity: 5 });
			const result = await controller.reserve({
				productId: "p1",
				quantity: 10,
			});
			expect(result).toBeNull();
		});

		it("allows over-reservation when backorder enabled", async () => {
			await controller.setStock({
				productId: "p1",
				quantity: 5,
				allowBackorder: true,
			});
			const result = await controller.reserve({
				productId: "p1",
				quantity: 10,
			});
			expect(result).not.toBeNull();
			expect(result?.reserved).toBe(10);
			expect(result?.available).toBe(0); // Max(0, 5-10) = 0
		});

		it("sequential reservations accumulate", async () => {
			await controller.setStock({ productId: "p1", quantity: 20 });
			await controller.reserve({ productId: "p1", quantity: 5 });
			await controller.reserve({ productId: "p1", quantity: 3 });
			const result = await controller.reserve({
				productId: "p1",
				quantity: 2,
			});
			expect(result?.reserved).toBe(10);
			expect(result?.available).toBe(10);
		});

		it("exact stock reservation succeeds", async () => {
			await controller.setStock({ productId: "p1", quantity: 7 });
			const result = await controller.reserve({
				productId: "p1",
				quantity: 7,
			});
			expect(result?.available).toBe(0);
			expect(result?.reserved).toBe(7);
		});

		it("returns null for non-existent product", async () => {
			const result = await controller.reserve({
				productId: "nonexistent",
				quantity: 1,
			});
			expect(result).toBeNull();
		});
	});

	// ── release — edge cases ────────────────────────────────────────

	describe("release — edge cases", () => {
		it("over-release floors reserved at zero", async () => {
			await controller.setStock({ productId: "p1", quantity: 10 });
			await controller.reserve({ productId: "p1", quantity: 3 });
			const result = await controller.release({
				productId: "p1",
				quantity: 100,
			});
			expect(result?.reserved).toBe(0);
			expect(result?.available).toBe(10);
		});

		it("partial release returns correct available", async () => {
			await controller.setStock({ productId: "p1", quantity: 10 });
			await controller.reserve({ productId: "p1", quantity: 6 });
			const result = await controller.release({
				productId: "p1",
				quantity: 2,
			});
			expect(result?.reserved).toBe(4);
			expect(result?.available).toBe(6);
		});
	});

	// ── deduct — fulfillment flow ───────────────────────────────────

	describe("deduct — fulfillment flow", () => {
		it("deducts from both quantity and reserved", async () => {
			await controller.setStock({ productId: "p1", quantity: 10 });
			await controller.reserve({ productId: "p1", quantity: 3 });
			const result = await controller.deduct({
				productId: "p1",
				quantity: 3,
			});
			expect(result?.quantity).toBe(7);
			expect(result?.reserved).toBe(0);
			expect(result?.available).toBe(7);
		});

		it("deduct floors both values at zero", async () => {
			await controller.setStock({ productId: "p1", quantity: 2 });
			await controller.reserve({ productId: "p1", quantity: 1 });
			const result = await controller.deduct({
				productId: "p1",
				quantity: 5,
			});
			expect(result?.quantity).toBe(0);
			expect(result?.reserved).toBe(0);
		});
	});

	// ── isInStock — untracked and edge cases ────────────────────────

	describe("isInStock — untracked products", () => {
		it("untracked product is always in stock", async () => {
			const result = await controller.isInStock({
				productId: "untracked",
			});
			expect(result).toBe(true);
		});

		it("untracked product with high quantity request is still in stock", async () => {
			const result = await controller.isInStock({
				productId: "untracked",
				quantity: 999,
			});
			expect(result).toBe(true);
		});

		it("backorder product is always in stock regardless of quantity", async () => {
			await controller.setStock({
				productId: "p1",
				quantity: 0,
				allowBackorder: true,
			});
			const result = await controller.isInStock({
				productId: "p1",
				quantity: 100,
			});
			expect(result).toBe(true);
		});

		it("out of stock when available < requested", async () => {
			await controller.setStock({ productId: "p1", quantity: 5 });
			await controller.reserve({ productId: "p1", quantity: 3 });

			// 2 available, requesting 3
			const result = await controller.isInStock({
				productId: "p1",
				quantity: 3,
			});
			expect(result).toBe(false);
		});

		it("defaults to quantity 1 when not specified", async () => {
			await controller.setStock({ productId: "p1", quantity: 1 });
			expect(await controller.isInStock({ productId: "p1" })).toBe(true);

			await controller.reserve({ productId: "p1", quantity: 1 });
			expect(await controller.isInStock({ productId: "p1" })).toBe(false);
		});
	});

	// ── getLowStockItems — threshold logic ──────────────────────────

	describe("getLowStockItems — threshold logic", () => {
		it("excludes items without threshold set", async () => {
			await controller.setStock({ productId: "p1", quantity: 2 });
			await controller.setStock({
				productId: "p2",
				quantity: 2,
				lowStockThreshold: 5,
			});

			const low = await controller.getLowStockItems({});
			expect(low).toHaveLength(1);
			expect(low[0].productId).toBe("p2");
		});

		it("reservations affect low-stock calculation", async () => {
			await controller.setStock({
				productId: "p1",
				quantity: 10,
				lowStockThreshold: 5,
			});

			// 10 quantity, threshold 5 — not low stock
			let low = await controller.getLowStockItems({});
			expect(low).toHaveLength(0);

			// Reserve 6 → available = 4, below threshold 5
			await controller.reserve({ productId: "p1", quantity: 6 });
			low = await controller.getLowStockItems({});
			expect(low).toHaveLength(1);
		});

		it("filters by location", async () => {
			await controller.setStock({
				productId: "p1",
				locationId: "loc-a",
				quantity: 1,
				lowStockThreshold: 5,
			});
			await controller.setStock({
				productId: "p2",
				locationId: "loc-b",
				quantity: 1,
				lowStockThreshold: 5,
			});

			const lowA = await controller.getLowStockItems({
				locationId: "loc-a",
			});
			expect(lowA).toHaveLength(1);
			expect(lowA[0].productId).toBe("p1");
		});
	});

	// ── Full lifecycle — reserve → release → deduct ─────────────────

	describe("full lifecycle", () => {
		it("set → reserve → partial release → deduct → verify", async () => {
			// Set initial stock
			await controller.setStock({ productId: "p1", quantity: 20 });

			// Reserve 10
			const afterReserve = await controller.reserve({
				productId: "p1",
				quantity: 10,
			});
			expect(afterReserve?.available).toBe(10);

			// Release 3 (reserved goes from 10 to 7)
			const afterRelease = await controller.release({
				productId: "p1",
				quantity: 3,
			});
			expect(afterRelease?.reserved).toBe(7);
			expect(afterRelease?.available).toBe(13);

			// Deduct 5 (fulfillment)
			const afterDeduct = await controller.deduct({
				productId: "p1",
				quantity: 5,
			});
			expect(afterDeduct?.quantity).toBe(15);
			expect(afterDeduct?.reserved).toBe(2);
			expect(afterDeduct?.available).toBe(13);

			// Verify final state
			const final = await controller.getStock({ productId: "p1" });
			expect(final?.quantity).toBe(15);
			expect(final?.reserved).toBe(2);
			expect(final?.available).toBe(13);
		});
	});

	// ── Back-in-stock subscriptions — edge cases ────────────────────

	describe("back-in-stock subscriptions — edge cases", () => {
		it("idempotent subscription — same email returns existing", async () => {
			const first = await controller.subscribeBackInStock({
				productId: "p1",
				email: "test@example.com",
			});
			const second = await controller.subscribeBackInStock({
				productId: "p1",
				email: "test@example.com",
			});
			expect(first.id).toBe(second.id);
		});

		it("email is normalized to lowercase", async () => {
			const sub = await controller.subscribeBackInStock({
				productId: "p1",
				email: "TEST@EXAMPLE.COM",
			});
			expect(sub.email).toBe("test@example.com");
		});

		it("different products get separate subscriptions", async () => {
			await controller.subscribeBackInStock({
				productId: "p1",
				email: "test@example.com",
			});
			await controller.subscribeBackInStock({
				productId: "p2",
				email: "test@example.com",
			});

			const p1Subs = await controller.getBackInStockSubscribers({
				productId: "p1",
			});
			expect(p1Subs).toHaveLength(1);

			const p2Subs = await controller.getBackInStockSubscribers({
				productId: "p2",
			});
			expect(p2Subs).toHaveLength(1);
		});

		it("unsubscribe returns false for non-existent subscription", async () => {
			const result = await controller.unsubscribeBackInStock({
				productId: "p1",
				email: "nobody@test.com",
			});
			expect(result).toBe(false);
		});

		it("check returns false after unsubscribe", async () => {
			await controller.subscribeBackInStock({
				productId: "p1",
				email: "test@example.com",
			});

			expect(
				await controller.checkBackInStockSubscription({
					productId: "p1",
					email: "test@example.com",
				}),
			).toBe(true);

			await controller.unsubscribeBackInStock({
				productId: "p1",
				email: "test@example.com",
			});

			expect(
				await controller.checkBackInStockSubscription({
					productId: "p1",
					email: "test@example.com",
				}),
			).toBe(false);
		});

		it("markSubscribersNotified only marks active subs", async () => {
			await controller.subscribeBackInStock({
				productId: "p1",
				email: "a@test.com",
			});
			await controller.subscribeBackInStock({
				productId: "p1",
				email: "b@test.com",
			});

			const count = await controller.markSubscribersNotified({
				productId: "p1",
			});
			expect(count).toBe(2);

			// After marking, check returns false (status is now "notified")
			expect(
				await controller.checkBackInStockSubscription({
					productId: "p1",
					email: "a@test.com",
				}),
			).toBe(false);
		});

		it("stats count active and notified correctly", async () => {
			await controller.subscribeBackInStock({
				productId: "p1",
				email: "active@test.com",
			});
			await controller.subscribeBackInStock({
				productId: "p1",
				email: "will-notify@test.com",
			});
			await controller.subscribeBackInStock({
				productId: "p2",
				email: "active2@test.com",
			});

			await controller.markSubscribersNotified({ productId: "p1" });

			const stats = await controller.getBackInStockStats();
			expect(stats.totalActive).toBe(1); // p2 active
			expect(stats.totalNotified).toBe(2); // p1 marked
			expect(stats.uniqueProducts).toBe(1); // only p2 has active subs
		});

		it("re-subscribing after notification creates a new active subscription", async () => {
			await controller.subscribeBackInStock({
				productId: "p1",
				email: "resubscribe@test.com",
			});
			await controller.markSubscribersNotified({ productId: "p1" });

			// Re-subscribing should create a new active subscription
			const resub = await controller.subscribeBackInStock({
				productId: "p1",
				email: "resubscribe@test.com",
			});
			expect(resub.status).toBe("active");
		});
	});

	// ── listItems — pagination and filtering ────────────────────────

	describe("listItems — pagination and filtering", () => {
		it("filters by productId", async () => {
			await controller.setStock({ productId: "p1", quantity: 10 });
			await controller.setStock({ productId: "p2", quantity: 5 });

			const items = await controller.listItems({ productId: "p1" });
			expect(items).toHaveLength(1);
			expect(items[0].productId).toBe("p1");
		});

		it("paginates with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.setStock({
					productId: `p${i}`,
					quantity: i + 1,
				});
			}

			const page1 = await controller.listItems({ take: 2, skip: 0 });
			expect(page1).toHaveLength(2);

			const page3 = await controller.listItems({ take: 2, skip: 4 });
			expect(page3).toHaveLength(1);
		});

		it("returns all items when no filters", async () => {
			await controller.setStock({ productId: "p1", quantity: 10 });
			await controller.setStock({
				productId: "p1",
				variantId: "v1",
				quantity: 5,
			});
			await controller.setStock({ productId: "p2", quantity: 3 });

			const all = await controller.listItems({});
			expect(all).toHaveLength(3);
			for (const item of all) {
				expect(item.available).toBeDefined();
			}
		});
	});
});
