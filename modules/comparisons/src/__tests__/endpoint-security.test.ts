import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { ComparisonController } from "../service";
import { createComparisonController } from "../service-impl";

/**
 * Security regression tests for comparison endpoints.
 *
 * These verify ownership isolation, rate-limit-style enforcement
 * (max products), duplicate prevention, and identity requirements
 * that the endpoint layer relies on.
 */
describe("comparisons endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ComparisonController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createComparisonController(mockData);
	});

	function itemParams(
		overrides: Partial<Parameters<typeof controller.addProduct>[0]> = {},
	) {
		return {
			productId: "prod_1",
			productName: "Test Product",
			productSlug: "test-product",
			...overrides,
		};
	}

	// -- Identity requirement enforcement --

	describe("identity requirement", () => {
		it("rejects addProduct when neither customerId nor sessionId is provided", async () => {
			await expect(controller.addProduct(itemParams())).rejects.toThrow(
				"Either customerId or sessionId is required",
			);
		});

		it("removeProduct returns false when no identity is provided", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			const result = await controller.removeProduct({
				productId: "prod_1",
			});
			expect(result).toBe(false);
		});

		it("getComparison returns empty when no identity is provided", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			const items = await controller.getComparison({});
			expect(items).toHaveLength(0);
		});

		it("clearComparison returns 0 when no identity is provided", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			const cleared = await controller.clearComparison({});
			expect(cleared).toBe(0);
		});
	});

	// -- Customer list isolation --

	describe("customer list isolation", () => {
		it("customer A cannot see customer B comparison items", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_A",
					productId: "prod_secret",
					productName: "Secret Product",
				}),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_B",
					productId: "prod_other",
					productSlug: "other",
				}),
			);

			const itemsA = await controller.getComparison({
				customerId: "cust_A",
			});
			const itemsB = await controller.getComparison({
				customerId: "cust_B",
			});

			expect(itemsA).toHaveLength(1);
			expect(itemsA[0]?.productId).toBe("prod_secret");
			expect(itemsB).toHaveLength(1);
			expect(itemsB[0]?.productId).toBe("prod_other");
		});

		it("clearing one customer does not affect another", async () => {
			await controller.addProduct(
				itemParams({ customerId: "cust_A", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_B",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			await controller.clearComparison({ customerId: "cust_A" });

			const remaining = await controller.getComparison({
				customerId: "cust_B",
			});
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.productId).toBe("prod_2");
		});

		it("removing a product for one customer preserves it for another", async () => {
			await controller.addProduct(
				itemParams({ customerId: "cust_A", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({ customerId: "cust_B", productId: "prod_1" }),
			);

			await controller.removeProduct({
				customerId: "cust_A",
				productId: "prod_1",
			});

			const custA = await controller.getComparison({
				customerId: "cust_A",
			});
			const custB = await controller.getComparison({
				customerId: "cust_B",
			});
			expect(custA).toHaveLength(0);
			expect(custB).toHaveLength(1);
		});

		it("countItems scoped by customerId only counts that customer", async () => {
			await controller.addProduct(
				itemParams({ customerId: "cust_A", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_A",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);
			await controller.addProduct(
				itemParams({ customerId: "cust_B", productId: "prod_3" }),
			);

			expect(await controller.countItems({ customerId: "cust_A" })).toBe(2);
			expect(await controller.countItems({ customerId: "cust_B" })).toBe(1);
		});

		it("session isolation prevents cross-session data leaks", async () => {
			await controller.addProduct(
				itemParams({ sessionId: "sess_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_2",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const sess1 = await controller.getComparison({
				sessionId: "sess_1",
			});
			const sess2 = await controller.getComparison({
				sessionId: "sess_2",
			});

			expect(sess1).toHaveLength(1);
			expect(sess1[0]?.productId).toBe("prod_1");
			expect(sess2).toHaveLength(1);
			expect(sess2[0]?.productId).toBe("prod_2");
		});
	});

	// -- Max products enforcement --

	describe("max products enforcement", () => {
		it("enforces default limit of 4 products", async () => {
			for (let i = 0; i < 4; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `p-${i}`,
					}),
				);
			}

			await expect(
				controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: "prod_overflow",
						productSlug: "overflow",
					}),
				),
			).rejects.toThrow("Comparison limit reached");
		});

		it("enforces custom maxProducts limit", async () => {
			for (let i = 0; i < 2; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `p-${i}`,
						maxProducts: 2,
					}),
				);
			}

			await expect(
				controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: "prod_overflow",
						productSlug: "overflow",
						maxProducts: 2,
					}),
				),
			).rejects.toThrow("Comparison limit reached");
		});

		it("max limit is per-customer, not global", async () => {
			for (let i = 0; i < 4; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `p-${i}`,
					}),
				);
			}

			// Different customer should still be able to add
			const item = await controller.addProduct(
				itemParams({
					customerId: "cust_2",
					productId: "prod_0",
				}),
			);
			expect(item?.customerId).toBe("cust_2");
		});

		it("max limit is per-session, not global", async () => {
			for (let i = 0; i < 4; i++) {
				await controller.addProduct(
					itemParams({
						sessionId: "sess_1",
						productId: `prod_${i}`,
						productSlug: `p-${i}`,
					}),
				);
			}

			// Different session should still be able to add
			const item = await controller.addProduct(
				itemParams({
					sessionId: "sess_2",
					productId: "prod_0",
				}),
			);
			expect(item?.sessionId).toBe("sess_2");
		});

		it("error message includes the configured max count", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_0",
					maxProducts: 1,
				}),
			);

			await expect(
				controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: "prod_1",
						productSlug: "p1",
						maxProducts: 1,
					}),
				),
			).rejects.toThrow("Maximum 1 products allowed");
		});

		it("merge respects max limit and discards excess session items", async () => {
			// Customer already at max
			for (let i = 0; i < 4; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_cust_${i}`,
						productSlug: `pc-${i}`,
					}),
				);
			}
			// Session has additional items
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_sess_0",
					productSlug: "ps-0",
				}),
			);

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(merged).toBe(0);

			// Session items cleaned up
			const sessItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessItems).toHaveLength(0);
		});
	});

	// -- Duplicate prevention --

	describe("duplicate prevention", () => {
		it("adding the same product twice updates instead of creating a duplicate", async () => {
			const first = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productName: "Original",
				}),
			);
			const second = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productName: "Updated",
				}),
			);

			expect(second?.id).toBe(first?.id);
			expect(second?.productName).toBe("Updated");

			const items = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(items).toHaveLength(1);
		});

		it("duplicate check is scoped to the owner, not global", async () => {
			const custA = await controller.addProduct(
				itemParams({ customerId: "cust_A" }),
			);
			const custB = await controller.addProduct(
				itemParams({ customerId: "cust_B" }),
			);

			// Same productId but different owners -> different items
			expect(custA?.id).not.toBe(custB?.id);

			const total = await controller.countItems();
			expect(total).toBe(2);
		});

		it("updating existing product at limit does not trigger limit error", async () => {
			for (let i = 0; i < 4; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `p-${i}`,
					}),
				);
			}

			// Updating an existing product should succeed even at max
			const updated = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_0",
					productName: "Updated at limit",
				}),
			);
			expect(updated?.productName).toBe("Updated at limit");
		});

		it("merge deduplicates products already in customer list", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_shared",
					productSlug: "shared",
				}),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_shared",
					productSlug: "shared",
				}),
			);

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(merged).toBe(0);

			// Customer still has exactly 1 item
			const custItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(custItems).toHaveLength(1);

			// Session duplicate was cleaned up
			const sessItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessItems).toHaveLength(0);
		});
	});

	// -- Product ID validation / boundary cases --

	describe("product ID validation", () => {
		it("treats different productId values as distinct items", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_A",
					productSlug: "a",
				}),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_B",
					productSlug: "b",
				}),
			);

			const items = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(items).toHaveLength(2);
		});

		it("removeProduct targets only the specified productId", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_keep",
					productSlug: "keep",
				}),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_remove",
					productSlug: "remove",
				}),
			);

			await controller.removeProduct({
				customerId: "cust_1",
				productId: "prod_remove",
			});

			const items = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(items).toHaveLength(1);
			expect(items[0]?.productId).toBe("prod_keep");
		});

		it("removeProduct returns false for non-existent productId", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));

			const result = await controller.removeProduct({
				customerId: "cust_1",
				productId: "prod_nonexistent",
			});
			expect(result).toBe(false);
		});

		it("deleteItem returns false for non-existent item id", async () => {
			const result = await controller.deleteItem("nonexistent-uuid");
			expect(result).toBe(false);
		});

		it("deleteItem does not affect unrelated items", async () => {
			const item1 = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_1",
				}),
			);
			const item2 = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			await controller.deleteItem(item1.id);

			const remaining = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.id).toBe(item2.id);
		});
	});

	// -- Merge security --

	describe("merge security", () => {
		it("merge transfers ownership from session to customer", async () => {
			await controller.addProduct(
				itemParams({
					sessionId: "sess_anon",
					productId: "prod_1",
					productName: "Anon Item",
				}),
			);

			await controller.mergeComparison({
				sessionId: "sess_anon",
				customerId: "cust_1",
			});

			const custItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(custItems).toHaveLength(1);
			expect(custItems[0]?.customerId).toBe("cust_1");
			expect(custItems[0]?.sessionId).toBeUndefined();
		});

		it("merge cleans up all session items even when over limit", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_cust_${i}`,
						productSlug: `pc-${i}`,
					}),
				);
			}
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						sessionId: "sess_1",
						productId: `prod_sess_${i}`,
						productSlug: `ps-${i}`,
					}),
				);
			}

			await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});

			// All session items should be gone regardless of merge outcome
			const sessItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessItems).toHaveLength(0);
		});

		it("merge does not affect other sessions", async () => {
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_1",
				}),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_other",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});

			const otherSess = await controller.getComparison({
				sessionId: "sess_other",
			});
			expect(otherSess).toHaveLength(1);
			expect(otherSess[0]?.productId).toBe("prod_2");
		});
	});
});
