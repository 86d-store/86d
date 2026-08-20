import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CartItem } from "../service";
import { createCartControllers } from "../service-impl";

// Helper to create addItem params with required product snapshot fields
function addItemParams(overrides: {
	cartId: string;
	productId: string;
	quantity: number;
	price: number;
	variantId?: string;
	productName?: string;
	productSlug?: string;
	productImage?: string;
	variantName?: string;
	variantOptions?: Record<string, string>;
}) {
	return {
		productName: "Test Product",
		productSlug: "test-product",
		...overrides,
	};
}

describe("createCartControllers", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCartControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCartControllers(mockData);
	});

	describe("getOrCreateCart", () => {
		it("creates a new cart for a customer", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_123",
			});

			expect(cart.id).toBe("cust_123");
			expect(cart.customerId).toBe("cust_123");
			expect(cart.status).toBe("active");
		});

		it("creates a new cart for a guest", async () => {
			const cart = await controller.getOrCreateCart({
				guestId: "guest_abc",
			});

			expect(cart.id).toBe("guest_abc");
			expect(cart.guestId).toBe("guest_abc");
			expect(cart.status).toBe("active");
		});

		it("returns existing cart if already created", async () => {
			const first = await controller.getOrCreateCart({ customerId: "cust_1" });
			const second = await controller.getOrCreateCart({ customerId: "cust_1" });

			expect(second.id).toBe(first.id);
			expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
		});

		it("creates a random cart when no customerId or guestId provided", async () => {
			const cart = await controller.getOrCreateCart({});
			expect(typeof cart.id).toBe("string");
			expect(cart.id.length).toBeGreaterThan(0);
		});

		it("new cart has expiration set ~7 days in the future", async () => {
			const cart = await controller.getOrCreateCart({ customerId: "exp_test" });
			const diff = cart.expiresAt.getTime() - Date.now();
			const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
			// Allow 1 second margin
			expect(diff).toBeGreaterThan(sevenDaysMs - 1000);
			expect(diff).toBeLessThan(sevenDaysMs + 1000);
		});
	});

	describe("addItem", () => {
		it("adds an item to a cart", async () => {
			const item = await controller.addItem(
				addItemParams({
					cartId: "cart_1",
					productId: "prod_1",
					quantity: 2,
					price: 9.99,
				}),
			);

			expect(item.cartId).toBe("cart_1");
			expect(item.productId).toBe("prod_1");
			expect(item.quantity).toBe(2);
			expect(item.price).toBe(9.99);
		});

		it("item ID is deterministic based on cartId and productId", async () => {
			const item = await controller.addItem(
				addItemParams({
					cartId: "cart_1",
					productId: "prod_1",
					quantity: 1,
					price: 5.0,
				}),
			);
			expect(item.id).toBe("cart_1_prod_1");
		});

		it("item ID includes variantId when provided", async () => {
			const item = await controller.addItem(
				addItemParams({
					cartId: "cart_1",
					productId: "prod_1",
					variantId: "var_red",
					quantity: 1,
					price: 5.0,
				}),
			);
			expect(item.id).toBe("cart_1_prod_1_var_red");
		});

		it("stores the item in the data service", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "cart_a",
					productId: "prod_b",
					quantity: 3,
					price: 12.5,
				}),
			);

			const stored = await mockData.get("cartItem", "cart_a_prod_b");
			expect(stored).not.toBeNull();
			expect((stored as CartItem).quantity).toBe(3);
		});

		it("stores product snapshot fields", async () => {
			const item = await controller.addItem(
				addItemParams({
					cartId: "cart_snap",
					productId: "prod_snap",
					quantity: 1,
					price: 2999,
					productName: "Blue T-Shirt",
					productSlug: "blue-t-shirt",
					productImage: "https://example.com/image.jpg",
				}),
			);

			expect(item.productName).toBe("Blue T-Shirt");
			expect(item.productSlug).toBe("blue-t-shirt");
			expect(item.productImage).toBe("https://example.com/image.jpg");
		});

		it("stores variant snapshot fields", async () => {
			const item = await controller.addItem(
				addItemParams({
					cartId: "cart_var",
					productId: "prod_var",
					variantId: "var_blue_m",
					quantity: 1,
					price: 3499,
					variantName: "Blue / Medium",
					variantOptions: { Color: "Blue", Size: "Medium" },
				}),
			);

			expect(item.variantName).toBe("Blue / Medium");
			expect(item.variantOptions).toEqual({
				Color: "Blue",
				Size: "Medium",
			});
		});

		it("leaves variant fields undefined when not provided", async () => {
			const item = await controller.addItem(
				addItemParams({
					cartId: "cart_no_var",
					productId: "prod_no_var",
					quantity: 1,
					price: 1999,
				}),
			);

			expect(item.variantId).toBeUndefined();
			expect(item.variantName).toBeUndefined();
			expect(item.variantOptions).toBeUndefined();
		});

		it("add same product twice merges quantity", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "merge_cart",
					productId: "prod_1",
					quantity: 2,
					price: 10,
				}),
			);
			const second = await controller.addItem(
				addItemParams({
					cartId: "merge_cart",
					productId: "prod_1",
					quantity: 3,
					price: 10,
				}),
			);
			expect(second.quantity).toBe(5);

			const items = await controller.getCartItems("merge_cart");
			expect(items).toHaveLength(1);
			expect(items[0].quantity).toBe(5);
		});

		it("caps merged quantity at 999", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "cap_cart",
					productId: "prod_cap",
					quantity: 998,
					price: 10,
				}),
			);
			const second = await controller.addItem(
				addItemParams({
					cartId: "cap_cart",
					productId: "prod_cap",
					quantity: 5,
					price: 10,
				}),
			);
			expect(second.quantity).toBe(999);
		});

		it("add same product twice preserves snapshot from first add", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "snap_cart",
					productId: "prod_snap",
					quantity: 1,
					price: 2999,
					productName: "Blue T-Shirt",
					productSlug: "blue-t-shirt",
					productImage: "https://example.com/image.jpg",
				}),
			);
			const merged = await controller.addItem(
				addItemParams({
					cartId: "snap_cart",
					productId: "prod_snap",
					quantity: 2,
					price: 999,
					productName: "Other",
					productSlug: "other",
				}),
			);
			expect(merged.quantity).toBe(3);
			expect(merged.price).toBe(2999);
			expect(merged.productName).toBe("Blue T-Shirt");
			expect(merged.productSlug).toBe("blue-t-shirt");
			expect(merged.productImage).toBe("https://example.com/image.jpg");
		});
	});

	describe("getCartItems", () => {
		it("returns empty array when cart has no items", async () => {
			const items = await controller.getCartItems("empty_cart");
			expect(items).toEqual([]);
		});

		it("returns items belonging to the cart", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "cart_x",
					productId: "prod_1",
					quantity: 1,
					price: 10,
				}),
			);
			await controller.addItem(
				addItemParams({
					cartId: "cart_x",
					productId: "prod_2",
					quantity: 2,
					price: 20,
				}),
			);
			// Add item for different cart (should not appear)
			await controller.addItem(
				addItemParams({
					cartId: "cart_y",
					productId: "prod_3",
					quantity: 1,
					price: 5,
				}),
			);

			const items = await controller.getCartItems("cart_x");
			expect(items).toHaveLength(2);
			expect(items.every((i) => i.cartId === "cart_x")).toBe(true);
		});
	});

	describe("getCartTotal", () => {
		it("returns 0 for empty cart", async () => {
			const total = await controller.getCartTotal("empty_cart");
			expect(total).toBe(0);
		});

		it("sums price * quantity for all items", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "total_cart",
					productId: "p1",
					quantity: 2,
					price: 10,
				}),
			);
			await controller.addItem(
				addItemParams({
					cartId: "total_cart",
					productId: "p2",
					quantity: 3,
					price: 5,
				}),
			);

			const total = await controller.getCartTotal("total_cart");
			expect(total).toBe(2 * 10 + 3 * 5); // 35
		});
	});

	describe("updateItem", () => {
		it("updates quantity of an existing item", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "upd_cart",
					productId: "prod_1",
					quantity: 1,
					price: 10,
				}),
			);

			const updated = await controller.updateItem("upd_cart_prod_1", 5);
			expect(updated.quantity).toBe(5);
		});

		it("preserves other item properties when updating", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "upd_cart2",
					productId: "prod_1",
					quantity: 1,
					price: 25.99,
					productName: "Widget",
					productSlug: "widget",
				}),
			);

			const updated = await controller.updateItem("upd_cart2_prod_1", 3);
			expect(updated.price).toBe(25.99);
			expect(updated.cartId).toBe("upd_cart2");
			expect(updated.productId).toBe("prod_1");
			expect(updated.productName).toBe("Widget");
			expect(updated.productSlug).toBe("widget");
		});

		it("throws when item does not exist", async () => {
			await expect(
				controller.updateItem("nonexistent_item", 1),
			).rejects.toThrow("nonexistent_item not found");
		});
	});

	describe("removeItem", () => {
		it("removes item from data service", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "rm_cart",
					productId: "prod_1",
					quantity: 1,
					price: 10,
				}),
			);

			await controller.removeItem("rm_cart_prod_1");
			const item = await mockData.get("cartItem", "rm_cart_prod_1");
			expect(item).toBeNull();
		});
	});

	describe("clearCart", () => {
		it("removes all items from the cart", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "clr_cart",
					productId: "p1",
					quantity: 1,
					price: 10,
				}),
			);
			await controller.addItem(
				addItemParams({
					cartId: "clr_cart",
					productId: "p2",
					quantity: 2,
					price: 20,
				}),
			);

			await controller.clearCart("clr_cart");
			const items = await controller.getCartItems("clr_cart");
			expect(items).toHaveLength(0);
		});

		it("does not remove items from other carts", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "clr_cart2",
					productId: "p1",
					quantity: 1,
					price: 10,
				}),
			);
			await controller.addItem(
				addItemParams({
					cartId: "other_cart",
					productId: "p2",
					quantity: 1,
					price: 10,
				}),
			);

			await controller.clearCart("clr_cart2");
			const otherItems = await controller.getCartItems("other_cart");
			expect(otherItems).toHaveLength(1);
		});
	});

	describe("isProductInActiveCart", () => {
		it("returns false when product is not in any cart", async () => {
			const result = await controller.isProductInActiveCart("prod_orphan");
			expect(result).toBe(false);
		});

		it("returns true when product is in an active cart", async () => {
			// Create active cart
			const cart = await controller.getOrCreateCart({
				customerId: "cust_active",
			});
			// Add product to it
			await controller.addItem(
				addItemParams({
					cartId: cart.id,
					productId: "prod_special",
					quantity: 1,
					price: 50,
				}),
			);

			const result = await controller.isProductInActiveCart("prod_special");
			expect(result).toBe(true);
		});
	});

	describe("getAbandonedCarts", () => {
		it("returns empty array when no carts exist", async () => {
			const result = await controller.getAbandonedCarts();
			expect(result).toEqual([]);
		});

		it("returns empty array when all carts are recently updated", async () => {
			await controller.getOrCreateCart({ customerId: "recent_1" });
			await controller.getOrCreateCart({ customerId: "recent_2" });

			const result = await controller.getAbandonedCarts({
				thresholdHours: 1,
			});
			expect(result).toEqual([]);
		});

		it("returns carts older than threshold", async () => {
			// Create a cart and manually backdate its updatedAt
			const cart = await controller.getOrCreateCart({
				customerId: "stale_cust",
			});
			const staleCart = {
				...cart,
				updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
			};
			await mockData.upsert(
				"cart",
				cart.id,
				staleCart as Record<string, unknown>,
			);

			const result = await controller.getAbandonedCarts({
				thresholdHours: 1,
			});
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("stale_cust");
		});

		it("does not return non-active carts", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "abandoned_cust",
			});
			const abandonedCart = {
				...cart,
				status: "abandoned" as const,
				updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
			};
			await mockData.upsert(
				"cart",
				cart.id,
				abandonedCart as Record<string, unknown>,
			);

			const result = await controller.getAbandonedCarts({
				thresholdHours: 1,
			});
			expect(result).toEqual([]);
		});

		it("respects take and skip parameters", async () => {
			// Create 3 stale carts
			for (let i = 0; i < 3; i++) {
				const cart = await controller.getOrCreateCart({
					customerId: `page_cust_${i}`,
				});
				const staleCart = {
					...cart,
					updatedAt: new Date(Date.now() - (i + 2) * 60 * 60 * 1000),
				};
				await mockData.upsert(
					"cart",
					cart.id,
					staleCart as Record<string, unknown>,
				);
			}

			const page1 = await controller.getAbandonedCarts({
				thresholdHours: 1,
				take: 2,
				skip: 0,
			});
			expect(page1).toHaveLength(2);

			const page2 = await controller.getAbandonedCarts({
				thresholdHours: 1,
				take: 2,
				skip: 2,
			});
			expect(page2).toHaveLength(1);
		});
	});

	describe("markAsAbandoned", () => {
		it("sets cart status to abandoned", async () => {
			await controller.getOrCreateCart({ customerId: "mark_aband" });

			const updated = await controller.markAsAbandoned("mark_aband");
			expect(updated.status).toBe("abandoned");
		});

		it("throws when cart does not exist", async () => {
			await expect(
				controller.markAsAbandoned("nonexistent_cart"),
			).rejects.toThrow("nonexistent_cart not found");
		});

		it("preserves other cart fields", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "preserve_test",
			});

			const updated = await controller.markAsAbandoned("preserve_test");
			expect(updated.customerId).toBe(cart.customerId);
			expect(updated.id).toBe(cart.id);
		});
	});

	describe("markRecoveryEmailSent", () => {
		it("tracks recovery email timestamp in metadata", async () => {
			await controller.getOrCreateCart({ customerId: "recovery_1" });

			const updated = await controller.markRecoveryEmailSent("recovery_1");
			const meta = updated.metadata as Record<string, unknown>;
			expect(meta.recoveryEmailSentAt).toBeDefined();
			expect(meta.recoveryEmailCount).toBe(1);
		});

		it("increments recovery email count on subsequent calls", async () => {
			await controller.getOrCreateCart({ customerId: "recovery_multi" });

			await controller.markRecoveryEmailSent("recovery_multi");
			const second = await controller.markRecoveryEmailSent("recovery_multi");
			const meta = second.metadata as Record<string, unknown>;
			expect(meta.recoveryEmailCount).toBe(2);
		});

		it("throws when cart does not exist", async () => {
			await expect(
				controller.markRecoveryEmailSent("nonexistent"),
			).rejects.toThrow("nonexistent not found");
		});
	});

	describe("getRecoveryStats", () => {
		it("returns zeros when no carts exist", async () => {
			const stats = await controller.getRecoveryStats();
			expect(stats).toEqual({
				totalAbandoned: 0,
				recoverySent: 0,
				recovered: 0,
			});
		});

		it("counts abandoned carts", async () => {
			await controller.getOrCreateCart({ customerId: "stat_aband_1" });
			await controller.markAsAbandoned("stat_aband_1");

			await controller.getOrCreateCart({ customerId: "stat_aband_2" });
			await controller.markAsAbandoned("stat_aband_2");

			const stats = await controller.getRecoveryStats();
			expect(stats.totalAbandoned).toBe(2);
		});

		it("counts carts with recovery emails sent", async () => {
			await controller.getOrCreateCart({ customerId: "stat_sent_1" });
			await controller.markRecoveryEmailSent("stat_sent_1");

			const stats = await controller.getRecoveryStats();
			expect(stats.recoverySent).toBe(1);
		});

		it("counts recovered carts", async () => {
			// Create a cart, send recovery, then manually convert
			await controller.getOrCreateCart({ customerId: "stat_recover" });
			await controller.markRecoveryEmailSent("stat_recover");

			// Manually set status to converted
			const cart = await mockData.get("cart", "stat_recover");
			await mockData.upsert("cart", "stat_recover", {
				...(cart as Record<string, unknown>),
				status: "converted",
			});

			const stats = await controller.getRecoveryStats();
			expect(stats.recovered).toBe(1);
		});
	});
});
