import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCartControllers } from "../service-impl";
import { removeFromCart } from "../store/endpoints/remove-from-cart";
import { updateCartItem } from "../store/endpoints/update-cart-item";

/**
 * Security regression tests for cart endpoints.
 *
 * Cart contains pre-purchase data with customer/guest isolation.
 * These tests verify:
 * - Customer/guest cart isolation: separate carts per identity
 * - Item ownership: items belong to a specific cart
 * - Cart total isolation: totals reflect only their own items
 * - Clear cart safety: clearing one cart does not affect others
 * - Abandoned cart stats don't leak cross-customer data
 * - Recovery email tracking is scoped per cart
 * - Item merge/variant behavior
 * - Pagination and boundary safety
 * - Quantity update and removal integrity
 */

describe("cart endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCartControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCartControllers(mockData);
	});

	function addWidget(
		cartId: string,
		overrides: Partial<Parameters<typeof controller.addItem>[0]> = {},
	) {
		return controller.addItem({
			cartId,
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			price: 1000,
			quantity: 1,
			...overrides,
		});
	}

	async function callEndpoint<
		E extends (...args: never[]) => Promise<unknown>,
		I extends Parameters<E>[0] & object,
	>(
		endpoint: E,
		input: I,
		context: {
			controllers: { cart: ReturnType<typeof createCartControllers> };
			session?:
				| {
						user: {
							id: string;
						};
				  }
				| undefined;
			headers?: Headers;
		},
	): Promise<Awaited<ReturnType<E>>> {
		return endpoint(
			Object.assign({}, input, { context }) as Parameters<E>[0],
		) as Promise<Awaited<ReturnType<E>>>;
	}

	// ── Cart Isolation ─────────────────────────────────────────────

	describe("customer/guest cart isolation", () => {
		it("different customers get different carts", async () => {
			const cart1 = await controller.getOrCreateCart({
				customerId: "cust_1",
			});
			const cart2 = await controller.getOrCreateCart({
				customerId: "cust_2",
			});

			expect(cart1.id).not.toBe(cart2.id);
		});

		it("same customer gets the same cart on repeated calls", async () => {
			const cart1 = await controller.getOrCreateCart({
				customerId: "cust_1",
			});
			const cart2 = await controller.getOrCreateCart({
				customerId: "cust_1",
			});

			expect(cart1.id).toBe(cart2.id);
		});

		it("guest cart is separate from customer cart", async () => {
			const guestCart = await controller.getOrCreateCart({
				guestId: "guest_1",
			});
			const customerCart = await controller.getOrCreateCart({
				customerId: "cust_1",
			});

			expect(guestCart.id).not.toBe(customerCart.id);
		});

		it("different guests get different carts", async () => {
			const g1 = await controller.getOrCreateCart({ guestId: "g1" });
			const g2 = await controller.getOrCreateCart({ guestId: "g2" });
			expect(g1.id).not.toBe(g2.id);
		});

		it("same guest gets the same cart on repeated calls", async () => {
			const g1 = await controller.getOrCreateCart({ guestId: "g1" });
			const g2 = await controller.getOrCreateCart({ guestId: "g1" });
			expect(g1.id).toBe(g2.id);
		});

		it("new cart starts with active status", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_new",
			});
			expect(cart.status).toBe("active");
		});

		it("new cart has an expiration date in the future", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_exp",
			});
			expect(new Date(cart.expiresAt).getTime()).toBeGreaterThan(Date.now());
		});
	});

	// ── Item Isolation ─────────────────────────────────────────────

	describe("cart item isolation", () => {
		it("items added to cart A do not appear in cart B", async () => {
			const cartA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			const cartB = await controller.getOrCreateCart({
				customerId: "cust_B",
			});

			await addWidget(cartA.id);

			const itemsA = await controller.getCartItems(cartA.id);
			const itemsB = await controller.getCartItems(cartB.id);

			expect(itemsA).toHaveLength(1);
			expect(itemsB).toHaveLength(0);
		});

		it("removing an item from one cart does not affect another cart", async () => {
			const cartA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			const cartB = await controller.getOrCreateCart({
				customerId: "cust_B",
			});

			const itemA = await addWidget(cartA.id);
			await addWidget(cartB.id, {
				productId: "prod_2",
				productName: "Gadget",
				productSlug: "gadget",
				price: 2000,
			});

			await controller.removeItem(itemA.id);

			const remainingB = await controller.getCartItems(cartB.id);
			expect(remainingB).toHaveLength(1);
			expect(remainingB[0].productId).toBe("prod_2");
		});

		it("updating item quantity in one cart does not affect items in another cart", async () => {
			const cartA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			const cartB = await controller.getOrCreateCart({
				customerId: "cust_B",
			});

			const itemA = await addWidget(cartA.id, { price: 500 });
			await addWidget(cartB.id, { price: 500 });

			await controller.updateItem(itemA.id, 10);

			const fetchedB = (await controller.getCartItems(cartB.id))[0];
			expect(fetchedB.quantity).toBe(1);
		});

		it("removing one item from a cart preserves other items in the same cart", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_1",
			});
			const item1 = await addWidget(cart.id, {
				productId: "p1",
				productName: "A",
				productSlug: "a",
			});
			await addWidget(cart.id, {
				productId: "p2",
				productName: "B",
				productSlug: "b",
			});
			await addWidget(cart.id, {
				productId: "p3",
				productName: "C",
				productSlug: "c",
			});

			await controller.removeItem(item1.id);

			const remaining = await controller.getCartItems(cart.id);
			expect(remaining).toHaveLength(2);
			expect(remaining.map((i) => i.productId).sort()).toEqual(["p2", "p3"]);
		});
	});

	// ── Item Merge Behavior ───────────────────────────────────────

	describe("item merge and variant handling", () => {
		it("adding same product twice merges quantity", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_1",
			});

			await addWidget(cart.id, { quantity: 2 });
			await addWidget(cart.id, { quantity: 3 });

			const items = await controller.getCartItems(cart.id);
			expect(items).toHaveLength(1);
			expect(items[0].quantity).toBe(5);
		});

		it("same product with different variants creates separate items", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_1",
			});

			await addWidget(cart.id, { variantId: "var_blue" });
			await addWidget(cart.id, { variantId: "var_red" });

			const items = await controller.getCartItems(cart.id);
			expect(items).toHaveLength(2);
		});

		it("same product and variant merges quantity", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_1",
			});

			await addWidget(cart.id, { variantId: "var_blue", quantity: 1 });
			await addWidget(cart.id, { variantId: "var_blue", quantity: 2 });

			const items = await controller.getCartItems(cart.id);
			expect(items).toHaveLength(1);
			expect(items[0].quantity).toBe(3);
		});

		it("item ID is deterministic based on cart, product, and variant", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_det",
			});

			const item = await addWidget(cart.id, {
				productId: "prod_x",
				variantId: "var_y",
			});
			expect(item.id).toBe(`${cart.id}_prod_x_var_y`);
		});

		it("item without variant has ID based on cart and product only", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_det2",
			});

			const item = await addWidget(cart.id, { productId: "prod_z" });
			expect(item.id).toBe(`${cart.id}_prod_z`);
		});
	});

	// ── Cart Totals ────────────────────────────────────────────────

	describe("cart total isolation", () => {
		it("total reflects only items in that specific cart", async () => {
			const cartA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			const cartB = await controller.getOrCreateCart({
				customerId: "cust_B",
			});

			await addWidget(cartA.id, { price: 100 });
			await addWidget(cartB.id, {
				productId: "prod_2",
				productName: "Expensive",
				productSlug: "expensive",
				price: 10000,
				quantity: 2,
			});

			const totalA = await controller.getCartTotal(cartA.id);
			const totalB = await controller.getCartTotal(cartB.id);

			expect(totalA).toBe(100);
			expect(totalB).toBe(20000);
		});

		it("empty cart total is zero regardless of other carts", async () => {
			const cartA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			const cartB = await controller.getOrCreateCart({
				customerId: "cust_B",
			});

			await addWidget(cartA.id, { price: 5000, quantity: 3 });

			const totalB = await controller.getCartTotal(cartB.id);
			expect(totalB).toBe(0);
		});

		it("total updates correctly after quantity change", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_total",
			});
			const item = await addWidget(cart.id, { price: 500, quantity: 2 });

			expect(await controller.getCartTotal(cart.id)).toBe(1000);

			await controller.updateItem(item.id, 5);

			expect(await controller.getCartTotal(cart.id)).toBe(2500);
		});

		it("total updates after item removal", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_rem",
			});
			const item1 = await addWidget(cart.id, {
				productId: "p1",
				productName: "A",
				productSlug: "a",
				price: 300,
			});
			await addWidget(cart.id, {
				productId: "p2",
				productName: "B",
				productSlug: "b",
				price: 700,
			});

			expect(await controller.getCartTotal(cart.id)).toBe(1000);

			await controller.removeItem(item1.id);

			expect(await controller.getCartTotal(cart.id)).toBe(700);
		});

		it("total with multiple items and quantities", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_multi",
			});
			await addWidget(cart.id, {
				productId: "p1",
				productName: "A",
				productSlug: "a",
				price: 100,
				quantity: 3,
			});
			await addWidget(cart.id, {
				productId: "p2",
				productName: "B",
				productSlug: "b",
				price: 250,
				quantity: 2,
			});

			expect(await controller.getCartTotal(cart.id)).toBe(800);
		});
	});

	// ── Clear Cart Safety ──────────────────────────────────────────

	describe("clear cart safety", () => {
		it("clearing one cart does not remove items from other carts", async () => {
			const cartA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			const cartB = await controller.getOrCreateCart({
				customerId: "cust_B",
			});

			await addWidget(cartA.id);
			await addWidget(cartB.id, {
				productId: "prod_2",
				productName: "Gadget",
				productSlug: "gadget",
				price: 2000,
			});

			await controller.clearCart(cartA.id);

			const itemsA = await controller.getCartItems(cartA.id);
			const itemsB = await controller.getCartItems(cartB.id);

			expect(itemsA).toHaveLength(0);
			expect(itemsB).toHaveLength(1);
		});

		it("clearing a cart zeroes its total without affecting other totals", async () => {
			const cartA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			const cartB = await controller.getOrCreateCart({
				customerId: "cust_B",
			});

			await addWidget(cartA.id, { price: 800, quantity: 2 });
			await addWidget(cartB.id, {
				productId: "prod_2",
				productName: "Gadget",
				productSlug: "gadget",
				price: 1200,
			});

			await controller.clearCart(cartA.id);

			expect(await controller.getCartTotal(cartA.id)).toBe(0);
			expect(await controller.getCartTotal(cartB.id)).toBe(1200);
		});

		it("clearing an already empty cart is a no-op", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_empty",
			});
			await controller.clearCart(cart.id);
			expect(await controller.getCartItems(cart.id)).toHaveLength(0);
			expect(await controller.getCartTotal(cart.id)).toBe(0);
		});

		it("clearing a cart with many items removes all", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_many",
			});
			for (let i = 0; i < 15; i++) {
				await addWidget(cart.id, {
					productId: `prod_${i}`,
					productName: `Item ${i}`,
					productSlug: `item-${i}`,
				});
			}
			expect(await controller.getCartItems(cart.id)).toHaveLength(15);

			await controller.clearCart(cart.id);
			expect(await controller.getCartItems(cart.id)).toHaveLength(0);
		});
	});

	// ── Abandoned Cart & Recovery Stats ────────────────────────────

	describe("abandoned cart stats isolation", () => {
		it("markAsAbandoned only changes the targeted cart status", async () => {
			const cartA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			await controller.getOrCreateCart({
				customerId: "cust_B",
			});

			await controller.markAsAbandoned(cartA.id);

			const refetchedA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			const refetchedB = await controller.getOrCreateCart({
				customerId: "cust_B",
			});

			expect(refetchedA.status).toBe("abandoned");
			expect(refetchedB.status).toBe("active");
		});

		it("recovery email tracking is scoped to the targeted cart", async () => {
			const cartA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			const cartB = await controller.getOrCreateCart({
				customerId: "cust_B",
			});

			await controller.markAsAbandoned(cartA.id);
			await controller.markAsAbandoned(cartB.id);
			await controller.markRecoveryEmailSent(cartA.id);

			const refetchedA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			const refetchedB = await controller.getOrCreateCart({
				customerId: "cust_B",
			});

			const metaA = refetchedA.metadata as Record<string, unknown>;
			const metaB = refetchedB.metadata as Record<string, unknown>;

			expect(metaA.recoveryEmailCount).toBe(1);
			expect(metaB.recoveryEmailCount).toBeUndefined();
		});

		it("getRecoveryStats counts only abandoned and recovered carts", async () => {
			const cartA = await controller.getOrCreateCart({
				customerId: "cust_A",
			});
			const cartB = await controller.getOrCreateCart({
				customerId: "cust_B",
			});
			await controller.getOrCreateCart({
				customerId: "cust_C",
			});

			await controller.markAsAbandoned(cartA.id);
			await controller.markRecoveryEmailSent(cartA.id);

			await controller.markAsAbandoned(cartB.id);

			const stats = await controller.getRecoveryStats();

			expect(stats.totalAbandoned).toBe(2);
			expect(stats.recoverySent).toBe(1);
			expect(stats.recovered).toBe(0);
		});

		it("multiple recovery emails increment the count", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_multi_email",
			});
			await controller.markAsAbandoned(cart.id);

			await controller.markRecoveryEmailSent(cart.id);
			await controller.markRecoveryEmailSent(cart.id);
			await controller.markRecoveryEmailSent(cart.id);

			const refetched = await controller.getOrCreateCart({
				customerId: "cust_multi_email",
			});
			const meta = refetched.metadata as Record<string, unknown>;
			expect(meta.recoveryEmailCount).toBe(3);
		});

		it("recovery stats with no carts returns zeros", async () => {
			const stats = await controller.getRecoveryStats();
			expect(stats.totalAbandoned).toBe(0);
			expect(stats.recoverySent).toBe(0);
			expect(stats.recovered).toBe(0);
		});
	});

	// ── Product Active Cart Check ──────────────────────────────────

	describe("isProductInActiveCart scoping", () => {
		it("returns false for a product only in an abandoned cart", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_1",
			});

			await addWidget(cart.id);

			expect(await controller.isProductInActiveCart("prod_1")).toBe(true);

			await controller.markAsAbandoned(cart.id);

			expect(await controller.isProductInActiveCart("prod_1")).toBe(false);
		});

		it("returns true only for the specific product, not all products", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_1",
			});

			await addWidget(cart.id);

			expect(await controller.isProductInActiveCart("prod_1")).toBe(true);
			expect(await controller.isProductInActiveCart("prod_2")).toBe(false);
		});

		it("returns true if product is in ANY active cart", async () => {
			const cart1 = await controller.getOrCreateCart({
				customerId: "cust_1",
			});
			const cart2 = await controller.getOrCreateCart({
				customerId: "cust_2",
			});

			await addWidget(cart1.id);
			await addWidget(cart2.id);

			// Abandon one cart
			await controller.markAsAbandoned(cart1.id);

			// Still true because cart2 is active
			expect(await controller.isProductInActiveCart("prod_1")).toBe(true);
		});

		it("returns false for a product that was removed from all active carts", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_rem",
			});

			const item = await addWidget(cart.id, { productId: "prod_gone" });
			expect(await controller.isProductInActiveCart("prod_gone")).toBe(true);

			await controller.removeItem(item.id);
			expect(await controller.isProductInActiveCart("prod_gone")).toBe(false);
		});

		it("returns false for a product never added to any cart", async () => {
			expect(await controller.isProductInActiveCart("never_added")).toBe(false);
		});
	});

	// ── Update Item Edge Cases ─────────────────────────────────────

	describe("updateItem safety", () => {
		it("updating non-existent item throws error", async () => {
			await expect(
				controller.updateItem("nonexistent_item", 5),
			).rejects.toThrow();
		});

		it("updateCartItem returns 404 instead of throwing for another customer's item", async () => {
			const victimCart = await controller.getOrCreateCart({
				customerId: "cust_victim",
			});
			const victimItem = await addWidget(victimCart.id);

			const response = await callEndpoint(
				updateCartItem,
				{
					params: { id: victimItem.id },
					body: { quantity: 2 },
				},
				{
					controllers: { cart: controller },
					session: { user: { id: "cust_attacker" } },
				},
			);

			expect(response).toEqual({ error: "Cart item not found", status: 404 });
		});

		it("updating quantity preserves other item fields", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_preserve",
			});
			const item = await addWidget(cart.id, {
				productId: "p_special",
				productName: "Special",
				productSlug: "special",
				price: 999,
				productImage: "img.png",
			});

			const updated = await controller.updateItem(item.id, 7);
			expect(updated.quantity).toBe(7);
			expect(updated.price).toBe(999);
			expect(updated.productName).toBe("Special");
			expect(updated.productSlug).toBe("special");
			expect(updated.productImage).toBe("img.png");
			expect(updated.cartId).toBe(cart.id);
		});
	});

	describe("removeFromCart safety", () => {
		it("removeFromCart returns 404 instead of throwing for another customer's item", async () => {
			const victimCart = await controller.getOrCreateCart({
				customerId: "cust_victim",
			});
			const victimItem = await addWidget(victimCart.id);

			const response = await callEndpoint(
				removeFromCart,
				{
					params: { id: victimItem.id },
				},
				{
					controllers: { cart: controller },
					session: { user: { id: "cust_attacker" } },
				},
			);

			expect(response).toEqual({ error: "Cart item not found", status: 404 });
		});
	});

	// ── Server-Side Price Validation (add-to-cart) ────────────────

	describe("server-side price validation (add-to-cart)", () => {
		/**
		 * Simulates the price validation logic from add-to-cart.ts.
		 * Uses a mock products data service to look up real prices.
		 */
		async function simulateAddToCartWithPriceValidation(
			ctrl: ReturnType<typeof createCartControllers>,
			cartId: string,
			body: {
				productId: string;
				variantId?: string;
				quantity: number;
				price: number;
				productName: string;
				productSlug: string;
			},
			productsDataService: ReturnType<typeof createMockDataService> | undefined,
		) {
			let price = body.price;

			if (productsDataService) {
				let trustedPrice: number | undefined;
				if (body.variantId) {
					const variant = (await productsDataService.get(
						"productVariant",
						body.variantId,
					)) as { price: number } | null;
					if (variant) trustedPrice = variant.price;
				}
				if (trustedPrice === undefined) {
					const product = (await productsDataService.get(
						"product",
						body.productId,
					)) as { price: number; status: string } | null;
					if (!product) {
						return { error: "Product not found", status: 404 };
					}
					if (product.status !== "active") {
						return { error: "Product is not available", status: 400 };
					}
					trustedPrice = product.price;
				}
				price = trustedPrice;
			}

			const item = await ctrl.addItem({
				cartId,
				productId: body.productId,
				...(body.variantId ? { variantId: body.variantId } : {}),
				quantity: body.quantity,
				price,
				productName: body.productName,
				productSlug: body.productSlug,
			});

			return { item };
		}

		it("overrides manipulated price with real product price", async () => {
			const productsData = createMockDataService();
			await productsData.upsert("product", "prod_1", {
				id: "prod_1",
				price: 2500,
				status: "active",
			});

			const cart = await controller.getOrCreateCart({
				customerId: "cust_price",
			});

			const result = await simulateAddToCartWithPriceValidation(
				controller,
				cart.id,
				{
					productId: "prod_1",
					quantity: 1,
					price: 1, // manipulated to $0.01
					productName: "Widget",
					productSlug: "widget",
				},
				productsData,
			);

			expect("item" in result).toBe(true);
			if ("item" in result) {
				expect(result.item.price).toBe(2500);
			}
		});

		it("uses variant price over product price", async () => {
			const productsData = createMockDataService();
			await productsData.upsert("product", "prod_1", {
				id: "prod_1",
				price: 2000,
				status: "active",
			});
			await productsData.upsert("productVariant", "var_xl", {
				id: "var_xl",
				price: 3500,
			});

			const cart = await controller.getOrCreateCart({
				customerId: "cust_var_price",
			});

			const result = await simulateAddToCartWithPriceValidation(
				controller,
				cart.id,
				{
					productId: "prod_1",
					variantId: "var_xl",
					quantity: 1,
					price: 1,
					productName: "Widget XL",
					productSlug: "widget-xl",
				},
				productsData,
			);

			expect("item" in result).toBe(true);
			if ("item" in result) {
				expect(result.item.price).toBe(3500);
			}
		});

		it("rejects non-existent product with 404", async () => {
			const productsData = createMockDataService();

			const cart = await controller.getOrCreateCart({
				customerId: "cust_ghost",
			});

			const result = await simulateAddToCartWithPriceValidation(
				controller,
				cart.id,
				{
					productId: "prod_missing",
					quantity: 1,
					price: 100,
					productName: "Ghost",
					productSlug: "ghost",
				},
				productsData,
			);

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.status).toBe(404);
			}
		});

		it("rejects inactive product with 400", async () => {
			const productsData = createMockDataService();
			await productsData.upsert("product", "prod_draft", {
				id: "prod_draft",
				price: 1000,
				status: "draft",
			});

			const cart = await controller.getOrCreateCart({
				customerId: "cust_inactive",
			});

			const result = await simulateAddToCartWithPriceValidation(
				controller,
				cart.id,
				{
					productId: "prod_draft",
					quantity: 1,
					price: 1000,
					productName: "Draft Item",
					productSlug: "draft-item",
				},
				productsData,
			);

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.status).toBe(400);
				expect(result.error).toContain("not available");
			}
		});

		it("accepts client price when no products registry exists", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_noproducts",
			});

			const result = await simulateAddToCartWithPriceValidation(
				controller,
				cart.id,
				{
					productId: "prod_1",
					quantity: 2,
					price: 777,
					productName: "Widget",
					productSlug: "widget",
				},
				undefined,
			);

			expect("item" in result).toBe(true);
			if ("item" in result) {
				expect(result.item.price).toBe(777);
			}
		});

		it("falls back to product price when variant not found", async () => {
			const productsData = createMockDataService();
			await productsData.upsert("product", "prod_1", {
				id: "prod_1",
				price: 1500,
				status: "active",
			});

			const cart = await controller.getOrCreateCart({
				customerId: "cust_fallback",
			});

			const result = await simulateAddToCartWithPriceValidation(
				controller,
				cart.id,
				{
					productId: "prod_1",
					variantId: "var_nonexistent",
					quantity: 1,
					price: 1,
					productName: "Widget",
					productSlug: "widget",
				},
				productsData,
			);

			expect("item" in result).toBe(true);
			if ("item" in result) {
				expect(result.item.price).toBe(1500);
			}
		});
	});

	// ── Cart Metadata Isolation ────────────────────────────────────

	describe("cart metadata isolation", () => {
		it("new cart has empty metadata", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_meta",
			});
			expect(cart.metadata).toEqual({});
		});

		it("markRecoveryEmailSent adds metadata to correct cart only", async () => {
			const cartA = await controller.getOrCreateCart({
				customerId: "cust_A_meta",
			});
			await controller.getOrCreateCart({
				customerId: "cust_B_meta",
			});

			await controller.markAsAbandoned(cartA.id);
			await controller.markRecoveryEmailSent(cartA.id);

			const refetchedA = await controller.getOrCreateCart({
				customerId: "cust_A_meta",
			});
			const refetchedB = await controller.getOrCreateCart({
				customerId: "cust_B_meta",
			});

			const metaA = refetchedA.metadata as Record<string, unknown>;
			expect(metaA.recoveryEmailSentAt).toBeDefined();
			expect(metaA.recoveryEmailCount).toBe(1);

			const metaB = refetchedB.metadata as Record<string, unknown>;
			expect(metaB.recoveryEmailSentAt).toBeUndefined();
		});
	});
});
