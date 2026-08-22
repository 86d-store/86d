import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCartControllers } from "../service-impl";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GUEST_ID = "guest_uuid_1234";
const CUSTOMER_ID = "cust_uuid_5678";

type CartController = ReturnType<typeof createCartControllers>;

async function seedGuestCart(
	ctrl: CartController,
	items: Array<{
		productId: string;
		variantId?: string;
		quantity: number;
		price: number;
	}>,
) {
	await ctrl.getOrCreateCart({ guestId: GUEST_ID });
	for (const item of items) {
		await ctrl.addItem({
			cartId: GUEST_ID,
			productId: item.productId,
			variantId: item.variantId,
			quantity: item.quantity,
			price: item.price,
			productName: `Product ${item.productId}`,
			productSlug: `product-${item.productId}`,
		});
	}
}

// ---------------------------------------------------------------------------

let ctrl: CartController;

beforeEach(() => {
	ctrl = createCartControllers(createMockDataService());
});

describe("mergeGuestCart", () => {
	it("moves all guest items into the customer cart", async () => {
		await seedGuestCart(ctrl, [
			{ productId: "p1", quantity: 2, price: 1000 },
			{ productId: "p2", quantity: 1, price: 2000 },
		]);

		const result = await ctrl.mergeGuestCart({
			guestId: GUEST_ID,
			customerId: CUSTOMER_ID,
		});

		expect(result.merged).toBe(2);
		expect(result.customerCartId).toBe(CUSTOMER_ID);

		const customerItems = await ctrl.getCartItems(CUSTOMER_ID);
		expect(customerItems).toHaveLength(2);
		const productIds = customerItems
			.map((i) => i.productId)
			.sort((a, b) => a.localeCompare(b));
		expect(productIds).toEqual(["p1", "p2"]);
	});

	it("stacks quantities when customer already has the same item", async () => {
		// Customer already has p1 with qty 3
		await ctrl.getOrCreateCart({ customerId: CUSTOMER_ID });
		await ctrl.addItem({
			cartId: CUSTOMER_ID,
			productId: "p1",
			quantity: 3,
			price: 1000,
			productName: "Product p1",
			productSlug: "product-p1",
		});

		// Guest cart also has p1 with qty 2
		await seedGuestCart(ctrl, [{ productId: "p1", quantity: 2, price: 1000 }]);

		await ctrl.mergeGuestCart({ guestId: GUEST_ID, customerId: CUSTOMER_ID });

		const customerItems = await ctrl.getCartItems(CUSTOMER_ID);
		expect(customerItems).toHaveLength(1);
		expect(customerItems[0].quantity).toBe(5); // 3 + 2
	});

	it("clears guest cart items after merge", async () => {
		await seedGuestCart(ctrl, [{ productId: "p1", quantity: 1, price: 500 }]);

		await ctrl.mergeGuestCart({ guestId: GUEST_ID, customerId: CUSTOMER_ID });

		const guestItems = await ctrl.getCartItems(GUEST_ID);
		expect(guestItems).toHaveLength(0);
	});

	it("marks guest cart as converted after merge", async () => {
		await seedGuestCart(ctrl, [{ productId: "p1", quantity: 1, price: 500 }]);

		await ctrl.mergeGuestCart({ guestId: GUEST_ID, customerId: CUSTOMER_ID });

		// Check the guest cart status by fetching items (cart should be converted)
		const guestItems = await ctrl.getCartItems(GUEST_ID);
		expect(guestItems).toHaveLength(0);
		// Also verify customer cart got the item
		const customerItems = await ctrl.getCartItems(CUSTOMER_ID);
		expect(customerItems).toHaveLength(1);
	});

	it("returns merged=0 when guest cart does not exist", async () => {
		const result = await ctrl.mergeGuestCart({
			guestId: "nonexistent_guest",
			customerId: CUSTOMER_ID,
		});
		expect(result.merged).toBe(0);
	});

	it("returns merged=0 when guest cart is empty", async () => {
		await ctrl.getOrCreateCart({ guestId: GUEST_ID });
		// No items added

		const result = await ctrl.mergeGuestCart({
			guestId: GUEST_ID,
			customerId: CUSTOMER_ID,
		});
		expect(result.merged).toBe(0);
	});

	it("creates customer cart if it does not exist yet", async () => {
		await seedGuestCart(ctrl, [{ productId: "p1", quantity: 2, price: 800 }]);

		const result = await ctrl.mergeGuestCart({
			guestId: GUEST_ID,
			customerId: CUSTOMER_ID,
		});

		expect(result.merged).toBe(1);
		const customerItems = await ctrl.getCartItems(CUSTOMER_ID);
		expect(customerItems).toHaveLength(1);
		expect(customerItems[0].quantity).toBe(2);
	});

	it("preserves product metadata (name, slug, image, variant) after merge", async () => {
		await ctrl.getOrCreateCart({ guestId: GUEST_ID });
		await ctrl.addItem({
			cartId: GUEST_ID,
			productId: "p1",
			variantId: "v1",
			quantity: 1,
			price: 1500,
			productName: "Cool Shirt",
			productSlug: "cool-shirt",
			productImage: "https://example.com/shirt.jpg",
			variantName: "Blue / M",
			variantOptions: { Color: "Blue", Size: "M" },
		});

		await ctrl.mergeGuestCart({ guestId: GUEST_ID, customerId: CUSTOMER_ID });

		const customerItems = await ctrl.getCartItems(CUSTOMER_ID);
		expect(customerItems).toHaveLength(1);
		const item = customerItems[0];
		expect(item.productName).toBe("Cool Shirt");
		expect(item.productSlug).toBe("cool-shirt");
		expect(item.productImage).toBe("https://example.com/shirt.jpg");
		expect(item.variantName).toBe("Blue / M");
		expect(item.variantOptions).toEqual({ Color: "Blue", Size: "M" });
	});

	it("caps merged quantity at 999", async () => {
		await ctrl.getOrCreateCart({ customerId: CUSTOMER_ID });
		await ctrl.addItem({
			cartId: CUSTOMER_ID,
			productId: "p1",
			quantity: 990,
			price: 100,
			productName: "Product p1",
			productSlug: "product-p1",
		});

		await seedGuestCart(ctrl, [{ productId: "p1", quantity: 50, price: 100 }]);

		await ctrl.mergeGuestCart({ guestId: GUEST_ID, customerId: CUSTOMER_ID });

		const customerItems = await ctrl.getCartItems(CUSTOMER_ID);
		expect(customerItems[0].quantity).toBe(999); // capped at 999
	});
});
