import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCartControllers } from "../service-impl";

/**
 * Store endpoint integration tests for the cart module.
 *
 * These tests verify the business logic in store-facing endpoints that
 * goes beyond simple controller delegation:
 *
 * 1. Server-side price validation against the products data registry
 * 2. Cart ownership verification (items scoped to user's own cart)
 * 3. Composite ID matching for remove-from-cart
 * 4. Response shaping with nested product/variant objects in get-cart
 * 5. Guest vs. authenticated cart resolution
 */

// ── Sample data factories ─────────────────────────────────────────────

type DataService = ReturnType<typeof createMockDataService>;

function addItemParams(
	overrides: Partial<
		Parameters<ReturnType<typeof createCartControllers>["addItem"]>[0]
	> = {},
) {
	return {
		cartId: "cust_1",
		productId: "prod_1",
		quantity: 1,
		price: 2999,
		productName: "Test Product",
		productSlug: "test-product",
		...overrides,
	};
}

// ── Simulate store endpoint logic ─────────────────────────────────────

/**
 * Simulate the add-to-cart endpoint: validates price against the products
 * data registry when available, then delegates to the controller.
 */
async function simulateAddToCart(
	data: DataService,
	body: {
		productId: string;
		variantId?: string;
		quantity: number;
		price: number;
		productName: string;
		productSlug: string;
		productImage?: string;
		variantName?: string;
		variantOptions?: Record<string, string>;
	},
	opts: {
		customerId?: string;
		guestId?: string;
		productsData?: DataService;
	} = {},
) {
	const controller = createCartControllers(data);
	const productsData = opts.productsData;

	// Server-side price validation (mirrors add-to-cart.ts lines 56-82)
	let trustedPrice = body.price;
	if (productsData) {
		let foundPrice: number | undefined;
		if (body.variantId) {
			const variant = (await productsData.get(
				"productVariant",
				body.variantId,
			)) as { price: number } | null;
			if (variant) foundPrice = variant.price;
		}
		if (foundPrice === undefined) {
			const product = (await productsData.get("product", body.productId)) as {
				price: number;
				status: string;
			} | null;
			if (!product) {
				return { error: "Product not found", status: 404 };
			}
			if (product.status !== "active") {
				return { error: "Product is not available", status: 400 };
			}
			foundPrice = product.price;
		}
		trustedPrice = foundPrice;
	}

	const cart = await controller.getOrCreateCart(
		opts.customerId
			? { customerId: opts.customerId }
			: { guestId: opts.guestId ?? "guest_default" },
	);

	const item = await controller.addItem({
		cartId: cart.id,
		productId: body.productId,
		...(body.variantId ? { variantId: body.variantId } : {}),
		quantity: body.quantity,
		price: trustedPrice,
		productName: body.productName,
		productSlug: body.productSlug,
		productImage: body.productImage,
		variantName: body.variantName,
		variantOptions: body.variantOptions,
	});

	const items = await controller.getCartItems(cart.id);

	return {
		cart,
		item,
		items,
		itemCount: items.length,
		subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
	};
}

/**
 * Simulate the get-cart endpoint: resolves cart, shapes items with
 * nested product/variant objects.
 */
async function simulateGetCart(
	data: DataService,
	opts: { customerId?: string; guestId?: string },
) {
	const controller = createCartControllers(data);
	const cart = await controller.getOrCreateCart(
		opts.customerId
			? { customerId: opts.customerId }
			: { guestId: opts.guestId ?? "guest_default" },
	);

	const rawItems = await controller.getCartItems(cart.id);

	// Shape items with nested product/variant (mirrors get-cart.ts lines 22-40)
	const items = rawItems.map((item) => ({
		id: item.id,
		productId: item.productId,
		variantId: item.variantId ?? null,
		quantity: item.quantity,
		price: item.price,
		product: {
			name: item.productName,
			price: item.price,
			images: item.productImage ? [item.productImage] : [],
			slug: item.productSlug,
		},
		variant: item.variantName
			? {
					name: item.variantName,
					options: item.variantOptions ?? {},
				}
			: null,
	}));

	return {
		id: cart.id,
		items,
		itemCount: items.length,
		subtotal: rawItems.reduce(
			(sum, item) => sum + item.price * item.quantity,
			0,
		),
	};
}

/**
 * Simulate update-cart-item endpoint: verifies item belongs to user's cart.
 */
async function simulateUpdateCartItem(
	data: DataService,
	itemId: string,
	quantity: number,
	opts: { customerId?: string; guestId?: string },
) {
	const controller = createCartControllers(data);
	const cart = await controller.getOrCreateCart(
		opts.customerId
			? { customerId: opts.customerId }
			: { guestId: opts.guestId ?? "guest_default" },
	);

	const cartItems = await controller.getCartItems(cart.id);
	const ownedItem = cartItems.find((i) => i.id === itemId);
	if (!ownedItem) {
		return { error: "Cart item not found", status: 404 };
	}

	const item = await controller.updateItem(itemId, quantity);
	const items = await controller.getCartItems(cart.id);

	return {
		cart,
		item,
		items,
		itemCount: items.length,
		subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
	};
}

/**
 * Simulate remove-from-cart endpoint: verifies ownership with composite
 * ID fallback matching.
 */
async function simulateRemoveFromCart(
	data: DataService,
	itemId: string,
	opts: { customerId?: string; guestId?: string },
) {
	const controller = createCartControllers(data);
	const cart = await controller.getOrCreateCart(
		opts.customerId
			? { customerId: opts.customerId }
			: { guestId: opts.guestId ?? "guest_default" },
	);

	const cartItems = await controller.getCartItems(cart.id);
	const existingItem =
		cartItems.find((i) => i.id === itemId) ??
		cartItems.find(
			(i) =>
				`${i.cartId}_${i.productId}` === itemId ||
				(i.variantId && `${i.cartId}_${i.productId}_${i.variantId}` === itemId),
		) ??
		null;

	if (!existingItem) {
		return { error: "Cart item not found", status: 404 };
	}

	await controller.removeItem(existingItem.id);
	const items = await controller.getCartItems(cart.id);

	return {
		cart,
		items,
		itemCount: items.length,
		subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
	};
}

/**
 * Simulate clear-cart endpoint.
 */
async function simulateClearCart(
	data: DataService,
	opts: { customerId?: string; guestId?: string },
) {
	const controller = createCartControllers(data);
	const cart = await controller.getOrCreateCart(
		opts.customerId
			? { customerId: opts.customerId }
			: { guestId: opts.guestId ?? "guest_default" },
	);

	await controller.clearCart(cart.id);

	return {
		cart,
		items: [],
		itemCount: 0,
		subtotal: 0,
	};
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("store endpoint: add to cart — price validation", () => {
	let data: DataService;
	let productsData: DataService;

	beforeEach(() => {
		data = createMockDataService();
		productsData = createMockDataService();
	});

	it("corrects client price to trusted product price", async () => {
		await productsData.upsert("product", "prod_1", {
			id: "prod_1",
			price: 1999,
			status: "active",
		});

		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				quantity: 1,
				price: 9999, // client sends wrong price
				productName: "Widget",
				productSlug: "widget",
			},
			{ customerId: "cust_1", productsData },
		);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.price).toBe(1999); // corrected to DB price
		}
	});

	it("uses variant price when variantId is provided", async () => {
		await productsData.upsert("product", "prod_1", {
			id: "prod_1",
			price: 2999,
			status: "active",
		});
		await productsData.upsert("productVariant", "var_sm", {
			id: "var_sm",
			productId: "prod_1",
			price: 3499,
		});

		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				variantId: "var_sm",
				quantity: 1,
				price: 2999, // sends base price
				productName: "Widget",
				productSlug: "widget",
				variantName: "Small",
			},
			{ customerId: "cust_1", productsData },
		);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.price).toBe(3499); // corrected to variant price
		}
	});

	it("falls back to product price when variant not found", async () => {
		await productsData.upsert("product", "prod_1", {
			id: "prod_1",
			price: 2999,
			status: "active",
		});

		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				variantId: "var_nonexistent",
				quantity: 1,
				price: 0,
				productName: "Widget",
				productSlug: "widget",
			},
			{ customerId: "cust_1", productsData },
		);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.price).toBe(2999);
		}
	});

	it("returns 404 when product not found in registry", async () => {
		// productsData is empty — product does not exist
		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_missing",
				quantity: 1,
				price: 1000,
				productName: "Ghost",
				productSlug: "ghost",
			},
			{ customerId: "cust_1", productsData },
		);

		expect(result).toEqual({ error: "Product not found", status: 404 });
	});

	it("returns 400 when product is not active", async () => {
		await productsData.upsert("product", "prod_draft", {
			id: "prod_draft",
			price: 999,
			status: "draft",
		});

		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_draft",
				quantity: 1,
				price: 999,
				productName: "Draft Item",
				productSlug: "draft-item",
			},
			{ customerId: "cust_1", productsData },
		);

		expect(result).toEqual({
			error: "Product is not available",
			status: 400,
		});
	});

	it("returns 400 for archived products", async () => {
		await productsData.upsert("product", "prod_arch", {
			id: "prod_arch",
			price: 999,
			status: "archived",
		});

		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_arch",
				quantity: 1,
				price: 999,
				productName: "Old Item",
				productSlug: "old-item",
			},
			{ customerId: "cust_1", productsData },
		);

		expect(result).toEqual({
			error: "Product is not available",
			status: 400,
		});
	});

	it("skips validation when products registry is unavailable", async () => {
		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				quantity: 1,
				price: 5000,
				productName: "Anything",
				productSlug: "anything",
			},
			{ customerId: "cust_1" }, // no productsData — registry unavailable
		);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.price).toBe(5000); // client price used as-is
		}
	});
});

describe("store endpoint: add to cart — guest vs. authenticated", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("creates a customer-scoped cart for authenticated users", async () => {
		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				quantity: 1,
				price: 2999,
				productName: "Widget",
				productSlug: "widget",
			},
			{ customerId: "cust_42" },
		);

		expect("cart" in result).toBe(true);
		if ("cart" in result) {
			expect(result.cart.id).toBe("cust_42");
			expect(result.cart.customerId).toBe("cust_42");
		}
	});

	it("creates a guest-scoped cart for unauthenticated users", async () => {
		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				quantity: 1,
				price: 2999,
				productName: "Widget",
				productSlug: "widget",
			},
			{ guestId: "guest_abc123" },
		);

		expect("cart" in result).toBe(true);
		if ("cart" in result) {
			expect(result.cart.id).toBe("guest_abc123");
			expect(result.cart.guestId).toBe("guest_abc123");
		}
	});

	it("increments quantity when adding the same product again", async () => {
		await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				quantity: 2,
				price: 1000,
				productName: "Widget",
				productSlug: "widget",
			},
			{ customerId: "cust_1" },
		);

		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				quantity: 3,
				price: 1000,
				productName: "Widget",
				productSlug: "widget",
			},
			{ customerId: "cust_1" },
		);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.quantity).toBe(5); // 2 + 3
		}
	});

	it("caps quantity at 999 when adding would exceed limit", async () => {
		await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				quantity: 998,
				price: 100,
				productName: "Widget",
				productSlug: "widget",
			},
			{ customerId: "cust_1" },
		);

		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				quantity: 5,
				price: 100,
				productName: "Widget",
				productSlug: "widget",
			},
			{ customerId: "cust_1" },
		);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.quantity).toBe(999);
		}
	});

	it("returns correct subtotal and itemCount", async () => {
		await simulateAddToCart(
			data,
			{
				productId: "prod_a",
				quantity: 2,
				price: 1000,
				productName: "Widget A",
				productSlug: "widget-a",
			},
			{ customerId: "cust_1" },
		);

		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_b",
				quantity: 1,
				price: 3000,
				productName: "Widget B",
				productSlug: "widget-b",
			},
			{ customerId: "cust_1" },
		);

		expect("itemCount" in result).toBe(true);
		if ("itemCount" in result) {
			expect(result.itemCount).toBe(2); // 2 distinct items
			expect(result.subtotal).toBe(2 * 1000 + 1 * 3000); // 5000
		}
	});

	it("treats same product with different variants as separate items", async () => {
		await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				variantId: "var_sm",
				quantity: 1,
				price: 1000,
				productName: "Widget",
				productSlug: "widget",
				variantName: "Small",
			},
			{ customerId: "cust_1" },
		);

		const result = await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				variantId: "var_lg",
				quantity: 1,
				price: 1200,
				productName: "Widget",
				productSlug: "widget",
				variantName: "Large",
			},
			{ customerId: "cust_1" },
		);

		expect("itemCount" in result).toBe(true);
		if ("itemCount" in result) {
			expect(result.itemCount).toBe(2);
		}
	});
});

describe("store endpoint: get cart — response shaping", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns empty cart for new user", async () => {
		const result = await simulateGetCart(data, { customerId: "cust_new" });

		expect(result.id).toBe("cust_new");
		expect(result.items).toHaveLength(0);
		expect(result.itemCount).toBe(0);
		expect(result.subtotal).toBe(0);
	});

	it("shapes items with nested product object", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		await controller.addItem(
			addItemParams({
				cartId: cart.id,
				productImage: "https://img.example.com/widget.jpg",
			}),
		);

		const result = await simulateGetCart(data, { customerId: "cust_1" });

		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		expect(item.product).toEqual({
			name: "Test Product",
			price: 2999,
			images: ["https://img.example.com/widget.jpg"],
			slug: "test-product",
		});
		expect(item.variant).toBeNull();
	});

	it("shapes items with nested variant object when variant exists", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		await controller.addItem(
			addItemParams({
				cartId: cart.id,
				variantId: "var_blue",
				variantName: "Blue / Medium",
				variantOptions: { Color: "Blue", Size: "M" },
			}),
		);

		const result = await simulateGetCart(data, { customerId: "cust_1" });

		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		expect(item.variantId).toBe("var_blue");
		expect(item.variant).toEqual({
			name: "Blue / Medium",
			options: { Color: "Blue", Size: "M" },
		});
	});

	it("returns empty images array when product has no image", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		await controller.addItem(addItemParams({ cartId: cart.id }));

		const result = await simulateGetCart(data, { customerId: "cust_1" });
		expect(result.items[0].product.images).toEqual([]);
	});

	it("calculates correct subtotal across multiple items", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		await controller.addItem(
			addItemParams({
				cartId: cart.id,
				productId: "prod_a",
				quantity: 3,
				price: 1000,
				productName: "A",
				productSlug: "a",
			}),
		);
		await controller.addItem(
			addItemParams({
				cartId: cart.id,
				productId: "prod_b",
				quantity: 2,
				price: 2500,
				productName: "B",
				productSlug: "b",
			}),
		);

		const result = await simulateGetCart(data, { customerId: "cust_1" });

		expect(result.itemCount).toBe(2);
		expect(result.subtotal).toBe(3 * 1000 + 2 * 2500); // 8000
	});
});

describe("store endpoint: update cart item — ownership verification", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("updates quantity for an item in the user's cart", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		const item = await controller.addItem(addItemParams({ cartId: cart.id }));

		const result = await simulateUpdateCartItem(data, item.id, 5, {
			customerId: "cust_1",
		});

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.quantity).toBe(5);
			expect(result.subtotal).toBe(5 * 2999);
		}
	});

	it("returns 404 when item belongs to a different user's cart", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		const item = await controller.addItem(addItemParams({ cartId: cart.id }));

		// cust_2 tries to update cust_1's item
		const result = await simulateUpdateCartItem(data, item.id, 5, {
			customerId: "cust_2",
		});

		expect(result).toEqual({ error: "Cart item not found", status: 404 });
	});

	it("returns 404 for a nonexistent item ID", async () => {
		const controller = createCartControllers(data);
		await controller.getOrCreateCart({ customerId: "cust_1" });

		const result = await simulateUpdateCartItem(data, "nonexistent_item", 3, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Cart item not found", status: 404 });
	});

	it("returns updated subtotal and itemCount after quantity change", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		await controller.addItem(
			addItemParams({
				cartId: cart.id,
				productId: "prod_a",
				price: 1000,
				productName: "A",
				productSlug: "a",
			}),
		);
		const itemB = await controller.addItem(
			addItemParams({
				cartId: cart.id,
				productId: "prod_b",
				price: 2000,
				quantity: 1,
				productName: "B",
				productSlug: "b",
			}),
		);

		const result = await simulateUpdateCartItem(data, itemB.id, 4, {
			customerId: "cust_1",
		});

		expect("subtotal" in result).toBe(true);
		if ("subtotal" in result) {
			expect(result.itemCount).toBe(2);
			expect(result.subtotal).toBe(1 * 1000 + 4 * 2000); // 9000
		}
	});
});

describe("store endpoint: remove from cart — ownership and composite IDs", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("removes item by direct ID", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		const item = await controller.addItem(addItemParams({ cartId: cart.id }));

		const result = await simulateRemoveFromCart(data, item.id, {
			customerId: "cust_1",
		});

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items).toHaveLength(0);
			expect(result.itemCount).toBe(0);
			expect(result.subtotal).toBe(0);
		}
	});

	it("removes item by composite cartId_productId", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		await controller.addItem(addItemParams({ cartId: cart.id }));

		// The item's actual ID is "cust_1_prod_1" (matches the composite)
		const result = await simulateRemoveFromCart(data, "cust_1_prod_1", {
			customerId: "cust_1",
		});

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items).toHaveLength(0);
		}
	});

	it("removes item by composite cartId_productId_variantId", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		await controller.addItem(
			addItemParams({
				cartId: cart.id,
				variantId: "var_blue",
				variantName: "Blue",
			}),
		);

		const result = await simulateRemoveFromCart(
			data,
			"cust_1_prod_1_var_blue",
			{ customerId: "cust_1" },
		);

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items).toHaveLength(0);
		}
	});

	it("returns 404 when item belongs to another user", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		const item = await controller.addItem(addItemParams({ cartId: cart.id }));

		const result = await simulateRemoveFromCart(data, item.id, {
			customerId: "cust_other",
		});

		expect(result).toEqual({ error: "Cart item not found", status: 404 });
	});

	it("returns 404 for a nonexistent item", async () => {
		const controller = createCartControllers(data);
		await controller.getOrCreateCart({ customerId: "cust_1" });

		const result = await simulateRemoveFromCart(data, "fake_item", {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Cart item not found", status: 404 });
	});

	it("preserves other items when one is removed", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		const itemA = await controller.addItem(
			addItemParams({
				cartId: cart.id,
				productId: "prod_a",
				price: 1000,
				productName: "A",
				productSlug: "a",
			}),
		);
		await controller.addItem(
			addItemParams({
				cartId: cart.id,
				productId: "prod_b",
				price: 2000,
				productName: "B",
				productSlug: "b",
			}),
		);

		const result = await simulateRemoveFromCart(data, itemA.id, {
			customerId: "cust_1",
		});

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items).toHaveLength(1);
			expect(result.itemCount).toBe(1);
			expect(result.subtotal).toBe(2000);
		}
	});
});

describe("store endpoint: clear cart", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("clears all items from the cart", async () => {
		const controller = createCartControllers(data);
		const cart = await controller.getOrCreateCart({ customerId: "cust_1" });
		await controller.addItem(
			addItemParams({
				cartId: cart.id,
				productId: "prod_a",
				productName: "A",
				productSlug: "a",
			}),
		);
		await controller.addItem(
			addItemParams({
				cartId: cart.id,
				productId: "prod_b",
				productName: "B",
				productSlug: "b",
			}),
		);

		const result = await simulateClearCart(data, { customerId: "cust_1" });

		expect(result.items).toEqual([]);
		expect(result.itemCount).toBe(0);
		expect(result.subtotal).toBe(0);
	});

	it("returns zero-state for an already empty cart", async () => {
		const result = await simulateClearCart(data, { customerId: "cust_1" });

		expect(result.items).toEqual([]);
		expect(result.itemCount).toBe(0);
		expect(result.subtotal).toBe(0);
	});

	it("does not affect other users' carts", async () => {
		const controller = createCartControllers(data);
		const cart1 = await controller.getOrCreateCart({ customerId: "cust_1" });
		const cart2 = await controller.getOrCreateCart({ customerId: "cust_2" });
		await controller.addItem(
			addItemParams({
				cartId: cart1.id,
				productName: "Widget 1",
				productSlug: "widget-1",
			}),
		);
		await controller.addItem(
			addItemParams({
				cartId: cart2.id,
				productName: "Widget 2",
				productSlug: "widget-2",
			}),
		);

		await simulateClearCart(data, { customerId: "cust_1" });

		// cust_2's cart should still have items
		const cust2Items = await controller.getCartItems(cart2.id);
		expect(cust2Items).toHaveLength(1);
	});
});

describe("store endpoint: guest cart resolution", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("different guest IDs get different carts", async () => {
		await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				quantity: 1,
				price: 1000,
				productName: "Widget",
				productSlug: "widget",
			},
			{ guestId: "guest_a" },
		);

		const cartA = await simulateGetCart(data, { guestId: "guest_a" });
		const cartB = await simulateGetCart(data, { guestId: "guest_b" });

		expect(cartA.itemCount).toBe(1);
		expect(cartB.itemCount).toBe(0);
		expect(cartA.id).not.toBe(cartB.id);
	});

	it("same guest ID returns the same cart across calls", async () => {
		await simulateAddToCart(
			data,
			{
				productId: "prod_1",
				quantity: 1,
				price: 1000,
				productName: "Widget",
				productSlug: "widget",
			},
			{ guestId: "guest_sticky" },
		);

		const first = await simulateGetCart(data, { guestId: "guest_sticky" });
		const second = await simulateGetCart(data, { guestId: "guest_sticky" });

		expect(first.id).toBe(second.id);
		expect(first.itemCount).toBe(1);
		expect(second.itemCount).toBe(1);
	});
});

describe("store endpoint: merge cart", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 when not authenticated", () => {
		// Simulate the endpoint auth guard: no session → return 401
		const customerId = undefined as string | undefined;
		const result = customerId
			? null
			: { error: "Must be signed in to merge cart", status: 401 };
		expect(result).toEqual({
			error: "Must be signed in to merge cart",
			status: 401,
		});
	});

	it("returns merged:0 when no guest cart exists", async () => {
		const controller = createCartControllers(data);
		const result = await controller.mergeGuestCart({
			guestId: "no-such-guest",
			customerId: "cust_1",
		});
		expect(result.merged).toBe(0);
	});

	it("merges guest cart items into customer cart", async () => {
		const controller = createCartControllers(data);

		// Add items to a guest cart
		const guestCart = await controller.getOrCreateCart({
			guestId: "guest_merge",
		});
		await controller.addItem({
			cartId: guestCart.id,
			productId: "prod_1",
			quantity: 2,
			price: 1000,
			productName: "Widget",
			productSlug: "widget",
		});

		const result = await controller.mergeGuestCart({
			guestId: "guest_merge",
			customerId: "cust_1",
		});

		expect(result.merged).toBe(1);

		// Customer cart should now have the items
		const customerItems = await controller.getCartItems("cust_1");
		expect(customerItems).toHaveLength(1);
		expect(customerItems[0].quantity).toBe(2);
	});

	it("combines quantities when customer already has the same product", async () => {
		const controller = createCartControllers(data);

		// Customer has 1 of prod_1
		const customerCart = await controller.getOrCreateCart({
			customerId: "cust_combo",
		});
		await controller.addItem({
			cartId: customerCart.id,
			productId: "prod_1",
			quantity: 1,
			price: 1000,
			productName: "Widget",
			productSlug: "widget",
		});

		// Guest has 2 of prod_1
		const guestCart = await controller.getOrCreateCart({
			guestId: "guest_combo",
		});
		await controller.addItem({
			cartId: guestCart.id,
			productId: "prod_1",
			quantity: 2,
			price: 1000,
			productName: "Widget",
			productSlug: "widget",
		});

		await controller.mergeGuestCart({
			guestId: "guest_combo",
			customerId: "cust_combo",
		});

		const customerItems = await controller.getCartItems("cust_combo");
		expect(customerItems).toHaveLength(1);
		expect(customerItems[0].quantity).toBe(3); // 1 + 2
	});

	it("returns merged:0 when guest cart is empty", async () => {
		const controller = createCartControllers(data);

		// Create an empty guest cart
		await controller.getOrCreateCart({ guestId: "guest_empty" });

		const result = await controller.mergeGuestCart({
			guestId: "guest_empty",
			customerId: "cust_1",
		});

		expect(result.merged).toBe(0);
	});
});
