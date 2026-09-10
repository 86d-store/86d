import { expect, type Page } from "@playwright/test";
import {
	assertCanonicalBasePriceRequest,
	createExactlyOnceRequestRecorder,
} from "./fixtures/exact-request-recorder";
import { test } from "./fixtures/test-fixtures";

const RECOVERY_CART = {
	id: "cart_browser_recovery",
	items: [
		{
			id: "cart_item_regent_loafer",
			productId: "product_regent_loafer",
			variantId: "variant_walnut_10",
			quantity: 1,
			product: {
				name: "Regent Penny Loafer",
				price: 18_900,
				images: [],
				slug: "regent-penny-loafer",
			},
			variant: { name: "Walnut / 10", price: 18_900 },
		},
		{
			id: "cart_item_leather_care",
			productId: "product_leather_care",
			variantId: null,
			quantity: 2,
			product: {
				name: "Italian Leather Care Kit",
				price: 2_400,
				images: [],
				slug: "italian-leather-care-kit",
			},
			variant: null,
		},
	],
	subtotal: 23_700,
	itemCount: 2,
};

async function installCheckoutRecoveryResponses(page: Page) {
	await page.route("**/api/cart/get", async (route) => {
		if (route.request().method() !== "GET") {
			await route.continue();
			return;
		}
		await route.fulfill({ json: RECOVERY_CART });
	});
	await page.route("**/api/store-credits/balance", async (route) => {
		if (route.request().method() !== "GET") {
			await route.continue();
			return;
		}
		await route.fulfill({
			json: { balance: 0, currency: "USD", status: "active" },
		});
	});
	await page.route("**/api/checkout/sessions", async (route) => {
		if (route.request().method() !== "POST") {
			await route.continue();
			return;
		}
		await route.fulfill({
			json: {
				session: {
					id: "checkout_browser_amount_only_gift_card",
					revision: 1,
					subtotal: 23_700,
					taxAmount: 0,
					shippingAmount: 0,
					discountAmount: 0,
					giftCardAmount: -500,
					storeCreditAmount: 0,
					total: 24_200,
					currency: "USD",
				},
			},
		});
	});
	await page.route("**/api/shipping/calculate", async (route) => {
		if (route.request().method() !== "POST") {
			await route.continue();
			return;
		}
		await route.fulfill({ json: { rates: [] } });
	});
}

async function submitCheckoutInformation(page: Page) {
	await page
		.getByRole("textbox", { name: /email/i })
		.fill("shopper@example.test");
	await page.getByRole("textbox", { name: /first name/i }).fill("Test");
	await page.getByRole("textbox", { name: /last name/i }).fill("Shopper");
	await page.getByRole("textbox", { name: /^Address/ }).fill("100 Main Street");
	await page.getByRole("textbox", { name: /city/i }).fill("Austin");
	await page.getByRole("textbox", { name: /state/i }).fill("TX");
	await page.getByRole("textbox", { name: /postal/i }).fill("78701");
	await page.getByRole("button", { name: "Continue to shipping" }).click();
	await expect(
		page.getByRole("heading", { name: "Shipping method" }),
	).toBeVisible();
}

test.describe("Commerce browser smoke", () => {
	test("browses from catalog to product, cart, and checkout", async ({
		storefront,
	}) => {
		await storefront.goto("/");
		await expect(storefront.navbar).toBeVisible();
		await storefront.addFirstInStockProductToCart();
		await expect(storefront.cartItems.first()).toBeVisible();
		await storefront.checkoutLink.click();
		await storefront.page.waitForURL((url) => url.pathname === "/checkout");
		await expect(
			storefront.page.getByRole("heading", { name: "Checkout" }),
		).toBeVisible();
		await expect(
			storefront.page.getByRole("textbox", { name: /email/i }),
		).toBeVisible();
	});

	test("persists the cart across a document navigation", async ({
		storefront,
	}) => {
		await storefront.addFirstInStockProductToCart();
		await storefront.goto("/");
		await storefront.openCart();
		await expect(storefront.cartItems.first()).toBeVisible();
	});

	test("requests product tiers once with canonical base-price cents", async ({
		storefront,
	}) => {
		const requests = createExactlyOnceRequestRecorder("bulk pricing tiers");
		const isTierRequest = (rawUrl: string) => {
			const url = new URL(rawUrl);
			return (
				url.pathname.startsWith("/api/bulk-pricing/product/") &&
				url.pathname.endsWith("/tiers")
			);
		};
		storefront.page.on("request", (request) => {
			if (isTierRequest(request.url())) requests.record(request.url());
		});
		const responsePromise = storefront.page.waitForResponse((response) =>
			isTierRequest(response.url()),
		);

		await storefront.navigateToFirstInStockProduct();
		const response = await responsePromise;
		expect(response.ok()).toBe(true);
		expect(
			assertCanonicalBasePriceRequest(requests.only()),
		).toBeGreaterThanOrEqual(0);
	});

	test("requests pickup windows once with the canonical encoded location", async ({
		page,
	}) => {
		const locationId = "downtown/location 1";
		const requests = createExactlyOnceRequestRecorder("pickup windows");
		const isWindowsRequest = (rawUrl: string) => {
			const url = new URL(rawUrl);
			return (
				url.pathname.startsWith("/api/store-pickup/locations/") &&
				url.pathname.endsWith("/windows")
			);
		};

		await page.clock.setFixedTime(new Date("2026-08-25T12:00:00.000Z"));
		page.on("request", (request) => {
			if (isWindowsRequest(request.url())) requests.record(request.url());
		});
		await page.route("**/api/store-pickup/locations", async (route) => {
			await route.fulfill({
				json: {
					locations: [
						{
							id: locationId,
							name: "Downtown",
							address: "100 Main Street",
							city: "Chicago",
							state: "IL",
							postalCode: "60601",
							country: "US",
							preparationMinutes: 30,
						},
					],
				},
			});
		});
		await page.route(
			"**/api/store-pickup/locations/**/windows?*",
			async (route) => {
				await route.fulfill({ json: { windows: [] } });
			},
		);

		await page.goto("/store-pickup");
		const locationSelect = page.getByLabel("Location");
		await expect(locationSelect).toHaveValue("");
		expect(requests.all()).toHaveLength(0);
		const responsePromise = page.waitForResponse((response) =>
			isWindowsRequest(response.url()),
		);
		await locationSelect.selectOption(locationId);
		expect((await responsePromise).ok()).toBe(true);
		await expect(
			page.getByText("No pickup windows available for this date."),
		).toBeVisible();

		const request = requests.only();
		expect(`${request.pathname}${request.search}`).toBe(
			"/api/store-pickup/locations/downtown%2Flocation%201/windows?date=2026-08-25",
		);
	});

	test("recovers an amount-only legacy gift-card adjustment", async ({
		page,
	}) => {
		await installCheckoutRecoveryResponses(page);
		await page.goto("/checkout");
		await submitCheckoutInformation(page);

		const summary = page.getByTestId("checkout-order-summary");
		const recovery = summary.getByTestId("checkout-retained-gift-card");
		await expect(recovery).toBeVisible();
		await expect(
			recovery.getByTestId("checkout-retained-gift-card-label"),
		).toHaveText("Stored gift card");
		await expect(
			recovery.getByRole("button", { name: "Remove" }),
		).toBeVisible();
		await expect(
			summary.getByTestId("checkout-retained-gift-card-adjustment"),
		).toHaveText("Legacy gift card adjustment: +$5.00");
		await expect(summary.getByTestId("checkout-order-total")).toHaveText(
			"$242.00",
		);
		await expect(summary).not.toContainText("−-$5.00");
	});
});
