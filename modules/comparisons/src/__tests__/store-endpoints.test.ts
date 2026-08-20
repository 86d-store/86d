import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createComparisonController } from "../service-impl";

type DataService = ReturnType<typeof createMockDataService>;

/**
 * Store endpoint integration tests for the comparisons module.
 *
 * Exercises the five store-facing operations through the controller:
 *   POST /comparisons/add     — addProduct
 *   GET  /comparisons         — getComparison
 *   POST /comparisons/remove  — removeProduct
 *   POST /comparisons/clear   — clearComparison
 *   POST /comparisons/merge   — mergeComparison
 */
describe("comparisons store endpoints", () => {
	let data: DataService;
	let controller: ReturnType<typeof createComparisonController>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createComparisonController(data);
	});

	function productParams(
		overrides: Partial<Parameters<typeof controller.addProduct>[0]> = {},
	) {
		return {
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			...overrides,
		};
	}

	// ── POST /comparisons/add ─────────────────────────────────────────────

	describe("add-product", () => {
		it("adds a product for an authenticated customer", async () => {
			const item = await controller.addProduct(
				productParams({ customerId: "cust_1" }),
			);

			expect(item.id).toBeDefined();
			expect(item.customerId).toBe("cust_1");
			expect(item.productId).toBe("prod_1");
			expect(item.productName).toBe("Widget");
			expect(item.productSlug).toBe("widget");
			expect(item.addedAt).toBeInstanceOf(Date);
		});

		it("adds a product for a guest session", async () => {
			const item = await controller.addProduct(
				productParams({ sessionId: "sess_guest" }),
			);

			expect(item.sessionId).toBe("sess_guest");
			expect(item.customerId).toBeUndefined();
			expect(item.productId).toBe("prod_1");
		});

		it("throws when neither customerId nor sessionId is provided", async () => {
			await expect(controller.addProduct(productParams())).rejects.toThrow(
				"Either customerId or sessionId is required",
			);
		});

		it("rejects when the comparison limit is reached", async () => {
			await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productId: "prod_1",
					maxProducts: 2,
				}),
			);
			await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productId: "prod_2",
					productName: "Gadget",
					productSlug: "gadget",
					maxProducts: 2,
				}),
			);

			await expect(
				controller.addProduct(
					productParams({
						customerId: "cust_1",
						productId: "prod_3",
						productName: "Doohickey",
						productSlug: "doohickey",
						maxProducts: 2,
					}),
				),
			).rejects.toThrow("Comparison limit reached. Maximum 2 products allowed");
		});

		it("updates snapshot data when adding a duplicate product", async () => {
			const first = await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productPrice: 999,
				}),
			);

			const second = await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productName: "Widget v2",
					productPrice: 1499,
				}),
			);

			// Same item updated, not a new entry
			expect(second.id).toBe(first.id);
			expect(second.productName).toBe("Widget v2");
			expect(second.productPrice).toBe(1499);

			// Only one item in the store
			const items = await controller.getComparison({ customerId: "cust_1" });
			expect(items).toHaveLength(1);
		});

		it("does not count a duplicate update against the limit", async () => {
			await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productId: "prod_1",
					maxProducts: 1,
				}),
			);

			// Updating the same product should succeed even at limit
			const updated = await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productId: "prod_1",
					productName: "Updated Widget",
					maxProducts: 1,
				}),
			);

			expect(updated.productName).toBe("Updated Widget");
		});
	});

	// ── GET /comparisons ──────────────────────────────────────────────────

	describe("list-comparison", () => {
		it("returns items for a known owner", async () => {
			await controller.addProduct(
				productParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productId: "prod_2",
					productName: "Gadget",
					productSlug: "gadget",
				}),
			);

			const items = await controller.getComparison({ customerId: "cust_1" });

			expect(items).toHaveLength(2);
			expect(items[0].productId).toBe("prod_1");
			expect(items[1].productId).toBe("prod_2");
		});

		it("returns empty array for an unknown owner", async () => {
			await controller.addProduct(productParams({ customerId: "cust_1" }));

			const items = await controller.getComparison({
				customerId: "cust_unknown",
			});
			expect(items).toEqual([]);
		});

		it("returns empty array when no identity is provided", async () => {
			await controller.addProduct(productParams({ customerId: "cust_1" }));

			const items = await controller.getComparison({});
			expect(items).toEqual([]);
		});

		it("isolates session items from customer items", async () => {
			await controller.addProduct(
				productParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				productParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productName: "Session Item",
					productSlug: "session-item",
				}),
			);

			const customerItems = await controller.getComparison({
				customerId: "cust_1",
			});
			const sessionItems = await controller.getComparison({
				sessionId: "sess_1",
			});

			expect(customerItems).toHaveLength(1);
			expect(customerItems[0].productId).toBe("prod_1");
			expect(sessionItems).toHaveLength(1);
			expect(sessionItems[0].productId).toBe("prod_2");
		});
	});

	// ── POST /comparisons/remove ──────────────────────────────────────────

	describe("remove-product", () => {
		it("removes a product and returns true", async () => {
			await controller.addProduct(productParams({ customerId: "cust_1" }));

			const removed = await controller.removeProduct({
				customerId: "cust_1",
				productId: "prod_1",
			});

			expect(removed).toBe(true);

			const items = await controller.getComparison({ customerId: "cust_1" });
			expect(items).toHaveLength(0);
		});

		it("returns false when removing a product that does not exist", async () => {
			await controller.addProduct(productParams({ customerId: "cust_1" }));

			const removed = await controller.removeProduct({
				customerId: "cust_1",
				productId: "prod_nonexistent",
			});

			expect(removed).toBe(false);
		});

		it("returns false when no identity is provided", async () => {
			await controller.addProduct(productParams({ customerId: "cust_1" }));

			const removed = await controller.removeProduct({
				productId: "prod_1",
			});

			expect(removed).toBe(false);
		});

		it("only removes the product for the specified owner", async () => {
			await controller.addProduct(
				productParams({ customerId: "cust_A", productId: "prod_shared" }),
			);
			await controller.addProduct(
				productParams({ customerId: "cust_B", productId: "prod_shared" }),
			);

			await controller.removeProduct({
				customerId: "cust_A",
				productId: "prod_shared",
			});

			const aItems = await controller.getComparison({ customerId: "cust_A" });
			const bItems = await controller.getComparison({ customerId: "cust_B" });

			expect(aItems).toHaveLength(0);
			expect(bItems).toHaveLength(1);
		});
	});

	// ── POST /comparisons/clear ───────────────────────────────────────────

	describe("clear-comparison", () => {
		it("clears all items and returns the count deleted", async () => {
			await controller.addProduct(
				productParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productId: "prod_2",
					productName: "Gadget",
					productSlug: "gadget",
				}),
			);
			await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productId: "prod_3",
					productName: "Doohickey",
					productSlug: "doohickey",
				}),
			);

			const cleared = await controller.clearComparison({
				customerId: "cust_1",
			});

			expect(cleared).toBe(3);

			const items = await controller.getComparison({ customerId: "cust_1" });
			expect(items).toHaveLength(0);
		});

		it("returns 0 when owner has no items", async () => {
			const cleared = await controller.clearComparison({
				customerId: "cust_empty",
			});
			expect(cleared).toBe(0);
		});

		it("returns 0 when no identity is provided", async () => {
			await controller.addProduct(productParams({ customerId: "cust_1" }));

			const cleared = await controller.clearComparison({});
			expect(cleared).toBe(0);
		});

		it("only clears items for the specified owner", async () => {
			await controller.addProduct(
				productParams({ customerId: "cust_A", productId: "prod_1" }),
			);
			await controller.addProduct(
				productParams({ customerId: "cust_B", productId: "prod_2" }),
			);

			await controller.clearComparison({ customerId: "cust_A" });

			const aItems = await controller.getComparison({ customerId: "cust_A" });
			const bItems = await controller.getComparison({ customerId: "cust_B" });

			expect(aItems).toHaveLength(0);
			expect(bItems).toHaveLength(1);
		});
	});

	// ── POST /comparisons/merge ───────────────────────────────────────────

	describe("merge-comparison", () => {
		it("transfers session items to authenticated customer", async () => {
			await controller.addProduct(
				productParams({
					sessionId: "sess_1",
					productId: "prod_1",
				}),
			);
			await controller.addProduct(
				productParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productName: "Gadget",
					productSlug: "gadget",
				}),
			);

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});

			expect(merged).toBe(2);

			const customerItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(customerItems).toHaveLength(2);

			// Session items should be gone
			const sessionItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessionItems).toHaveLength(0);
		});

		it("respects the max products limit during merge", async () => {
			// Customer already has 1 item
			await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productId: "prod_existing",
					productName: "Existing",
					productSlug: "existing",
				}),
			);

			// Session has 3 items
			await controller.addProduct(
				productParams({
					sessionId: "sess_1",
					productId: "prod_a",
					productName: "A",
					productSlug: "a",
				}),
			);
			await controller.addProduct(
				productParams({
					sessionId: "sess_1",
					productId: "prod_b",
					productName: "B",
					productSlug: "b",
				}),
			);
			await controller.addProduct(
				productParams({
					sessionId: "sess_1",
					productId: "prod_c",
					productName: "C",
					productSlug: "c",
				}),
			);

			// Limit is 3 — customer has 1, so only 2 session items can transfer
			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
				maxProducts: 3,
			});

			expect(merged).toBe(2);

			const customerItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(customerItems).toHaveLength(3);

			// All session items cleaned up (transferred or discarded)
			const sessionItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessionItems).toHaveLength(0);
		});

		it("handles duplicate products by keeping customer version", async () => {
			// Customer has prod_1
			await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productId: "prod_1",
					productName: "Customer Version",
				}),
			);

			// Session also has prod_1
			await controller.addProduct(
				productParams({
					sessionId: "sess_1",
					productId: "prod_1",
					productName: "Session Version",
				}),
			);

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});

			// Duplicate not transferred
			expect(merged).toBe(0);

			const customerItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(customerItems).toHaveLength(1);
			expect(customerItems[0].productName).toBe("Customer Version");

			// Session duplicate cleaned up
			const sessionItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessionItems).toHaveLength(0);
		});

		it("returns 0 when session has no items", async () => {
			const merged = await controller.mergeComparison({
				sessionId: "sess_empty",
				customerId: "cust_1",
			});

			expect(merged).toBe(0);
		});

		it("merges a mix of new and duplicate products", async () => {
			// Customer has prod_1
			await controller.addProduct(
				productParams({
					customerId: "cust_1",
					productId: "prod_1",
				}),
			);

			// Session has prod_1 (duplicate) and prod_2 (new)
			await controller.addProduct(
				productParams({
					sessionId: "sess_1",
					productId: "prod_1",
				}),
			);
			await controller.addProduct(
				productParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productName: "New Item",
					productSlug: "new-item",
				}),
			);

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});

			// Only the non-duplicate transferred
			expect(merged).toBe(1);

			const customerItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(customerItems).toHaveLength(2);
		});
	});
});
