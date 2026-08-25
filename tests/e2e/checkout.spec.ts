import { expect } from "@playwright/test";
import { test } from "./fixtures/test-fixtures";

test.describe("Checkout — Full flow", () => {
	test("complete flow: browse → add to cart → view checkout", async ({
		storefront,
	}) => {
		/* 1. Start on homepage */
		await storefront.goto("/");
		await expect(storefront.navbar).toBeVisible();

		/* 2–6. Add an in-stock product and wait for the persisted cart state. */
		await storefront.addFirstInStockProductToCart();

		/* 7. Verify cart has items */
		const itemCount = await storefront.cartItems.count();
		expect(itemCount).toBeGreaterThan(0);

		/* 8. Click checkout link */
		await expect(storefront.checkoutLink).toBeVisible();
		await storefront.checkoutLink.click();
		await storefront.page.waitForURL(/\/checkout/, {
			timeout: 10_000,
		});

		/* 9. Checkout page should render */
		const checkoutHeading = storefront.page
			.locator("h1")
			.filter({ hasText: /checkout/i });
		await expect(checkoutHeading).toBeVisible({ timeout: 10_000 });
	});

	test("checkout page shows order summary", async ({ storefront }) => {
		await storefront.addFirstInStockProductToCart();

		/* Navigate to checkout */
		await storefront.page.goto("/checkout");
		await storefront.page.waitForLoadState("load");

		/* Should show product name or price somewhere */
		const price = storefront.page
			.locator("span, p, div")
			.filter({ hasText: /^\$/ })
			.first();
		await expect(price).toBeVisible({ timeout: 10_000 });
	});

	test("checkout page has customer info fields", async ({ storefront }) => {
		await storefront.addFirstInStockProductToCart();

		await storefront.page.goto("/checkout");
		await storefront.page.waitForLoadState("load");

		/* Should have email and name inputs for customer info */
		const emailInput = storefront.page.getByRole("textbox", {
			name: /email/i,
		});
		const nameInput = storefront.page.getByRole("textbox", {
			name: /first name/i,
		});
		await expect(emailInput).toBeVisible({ timeout: 10_000 });
		await expect(nameInput).toBeVisible();
	});
});

test.describe("Checkout — Edge cases", () => {
	test("checkout page with empty cart shows appropriate message", async ({
		storefront,
	}) => {
		await storefront.page.goto("/checkout");
		await expect(
			storefront.page.getByText("Your cart is empty", { exact: true }),
		).toBeVisible();
	});

	test("cart persists across page navigations", async ({ storefront }) => {
		await storefront.addFirstInStockProductToCart();

		/* Navigate to homepage */
		await storefront.goto("/");
		await storefront.page.waitForLoadState("domcontentloaded");

		/* Open cart — should still have items */
		await storefront.openCart();
		await expect(storefront.cartItems.first()).toBeVisible();
	});
});
