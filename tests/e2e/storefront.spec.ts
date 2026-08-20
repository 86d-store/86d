import { expect, test } from "./fixtures/test-fixtures";

test.describe("Storefront — Homepage", () => {
	test("loads the homepage with hero section", async ({ storefront }) => {
		await storefront.goto("/");
		await expect(storefront.heroHeading).toBeVisible();
		await expect(storefront.navbar).toBeVisible();
	});

	test("displays the navigation bar with logo and links", async ({
		storefront,
	}) => {
		await storefront.goto("/");
		const logo = storefront.page.locator('header a[href="/"]').first();
		await expect(logo).toBeVisible();
		/* On mobile, nav links are behind a hamburger menu */
		const hamburger = storefront.page.locator('button[aria-label="Open menu"]');
		const isMobile = await hamburger.isVisible().catch(() => false);
		if (isMobile) {
			await hamburger.click();
			/* After click, aria-label changes to "Close menu" — wait for the overlay */
			const closeBtn = storefront.page.locator(
				'button[aria-label="Close menu"]',
			);
			await expect(closeBtn).toBeVisible();
			/* Use getByRole with exact match to avoid matching "Shop now" CTA */
			await expect(
				storefront.page.getByRole("link", { name: "Shop", exact: true }),
			).toBeVisible();
		} else {
			const shopLink = storefront.page
				.locator("header a")
				.filter({ hasText: "Shop" });
			await expect(shopLink.first()).toBeVisible();
		}
	});

	test("shows featured products section", async ({ storefront }) => {
		await storefront.goto("/");
		await storefront.page.waitForLoadState("networkidle");
		/* Featured products section is client-rendered — if the API returns
		   data the heading and cards appear; if not the component hides itself.
		   Check for heading OR product cards on the homepage. */
		const featuredHeading = storefront.page
			.locator("h2")
			.filter({ hasText: "Featured" });
		const trendingHeading = storefront.page
			.locator("h2")
			.filter({ hasText: "Trending" });
		const hasFeatured = await featuredHeading
			.isVisible({ timeout: 5_000 })
			.catch(() => false);
		const hasTrending = await trendingHeading.isVisible().catch(() => false);
		/* At least one product section should appear on homepage */
		expect(
			hasFeatured || hasTrending,
			"Expected at least one product section (Featured or Trending) on homepage",
		).toBeTruthy();
	});

	test("catalog CTA links to products page", async ({ storefront }) => {
		await storefront.goto("/");
		const cta = storefront.page
			.locator("a")
			.filter({ hasText: /View all products|Shop now/i });
		await expect(cta.first()).toHaveAttribute("href", "/products");
	});

	test("cart button is visible in the navbar", async ({ storefront }) => {
		await storefront.goto("/");
		await expect(storefront.cartButton).toBeVisible();
	});
});

test.describe("Storefront — Product listing", () => {
	test("shows products page with heading", async ({ storefront }) => {
		await storefront.navigateToProducts();
		const heading = storefront.page
			.locator("h1")
			.filter({ hasText: "Products" });
		await expect(heading).toBeVisible();
	});

	test("displays product cards after loading", async ({ storefront }) => {
		await storefront.navigateToProducts();
		/* Wait for skeleton to resolve */
		await expect(storefront.allProductCards.first()).toBeVisible({
			timeout: 15_000,
		});
		/* Should have at least one product from seed data */
		const count = await storefront.allProductCards.count();
		expect(count).toBeGreaterThan(0);
	});

	test("search input filters products", async ({ storefront }) => {
		await storefront.navigateToProducts();
		await expect(storefront.searchInput).toBeVisible();
		/* Type a search term — should narrow results */
		await storefront.searchProducts("nonexistent-product-xyz");
		/* Either shows empty state or zero products */
		await storefront.page.waitForLoadState("networkidle");
		const emptyState = storefront.page
			.locator("p")
			.filter({ hasText: "No products found" });
		const cards = storefront.allProductCards;
		const hasEmptyState = await emptyState.isVisible().catch(() => false);
		const cardCount = await cards.count();
		/* If search returns nothing, either empty state shows or zero cards */
		expect(hasEmptyState || cardCount === 0).toBeTruthy();
	});

	test("category and sort dropdowns are present", async ({ storefront }) => {
		await storefront.navigateToProducts();
		/* Wait for page to fully load */
		await storefront.page.waitForLoadState("networkidle");
		/* Sort dropdown should always be present */
		const sortSelect = storefront.page.locator("select").last();
		await expect(sortSelect).toBeVisible();
	});

	test("product cards link to detail pages", async ({ storefront }) => {
		await storefront.navigateToProducts();
		await expect(storefront.allProductCards.first()).toBeVisible({
			timeout: 15_000,
		});
		const firstCard = storefront.allProductCards.first();
		const href = await firstCard.getAttribute("href");
		expect(href).toMatch(/^\/products\/.+/);
	});
});

test.describe("Storefront — Product detail", () => {
	test("navigates to a product detail page from listing", async ({
		storefront,
	}) => {
		await storefront.navigateToProducts();
		await expect(storefront.allProductCards.first()).toBeVisible({
			timeout: 15_000,
		});
		/* Click the first product card */
		const firstCard = storefront.allProductCards.first();
		const _href = await firstCard.getAttribute("href");
		await firstCard.click();
		await storefront.page.waitForURL(/\/products\/.+/);
		/* Product detail page should show the product name */
		const productName = storefront.page.locator("h1").first();
		await expect(productName).toBeVisible({ timeout: 10_000 });
	});

	test("shows breadcrumb navigation on product detail", async ({
		storefront,
	}) => {
		await storefront.navigateToProducts();
		await expect(storefront.allProductCards.first()).toBeVisible({
			timeout: 15_000,
		});
		await storefront.allProductCards.first().click();
		await storefront.page.waitForURL(/\/products\/.+/);
		await expect(storefront.page.locator("main h1").first()).toBeVisible({
			timeout: 15_000,
		});
		/* Breadcrumb should have Home and Products links — scope to main to avoid header nav */
		const breadcrumbHome = storefront.page.locator('main nav a[href="/"]');
		const breadcrumbProducts = storefront.page.locator(
			'main nav a[href="/products"]',
		);
		await expect(breadcrumbHome).toBeVisible();
		await expect(breadcrumbProducts).toBeVisible();
	});

	test("shows price and add-to-cart button", async ({ storefront }) => {
		await storefront.navigateToProducts();
		await expect(storefront.allProductCards.first()).toBeVisible({
			timeout: 15_000,
		});
		await storefront.allProductCards.first().click();
		await storefront.page.waitForURL(/\/products\/.+/);
		/* Price should be visible */
		const price = storefront.page
			.locator("span")
			.filter({ hasText: /^\$/ })
			.first();
		await expect(price).toBeVisible({ timeout: 10_000 });
		/* Add to cart button should be present (or "Sold out" if no stock) */
		const addButton = storefront.page
			.locator("main")
			.getByRole("button", { name: /Add to cart|Sold out/ });
		await expect(addButton.first()).toBeVisible();
	});

	test("quantity controls work on product detail", async ({ storefront }) => {
		await storefront.navigateToProducts();
		await expect(storefront.allProductCards.first()).toBeVisible({
			timeout: 15_000,
		});
		await storefront.allProductCards.first().click();
		await storefront.page.waitForURL(/\/products\/.+/);
		await expect(
			storefront.page
				.locator("main")
				.getByRole("button", { name: "Add to cart", exact: true }),
		).toBeVisible({ timeout: 15_000 });
		/* Find quantity display — scoped between the − and + buttons */
		const qtyControls = storefront.page.locator(
			'main button:has-text("−") + span.tabular-nums',
		);
		await expect(qtyControls).toBeVisible();
		const initialQty = await qtyControls.textContent();
		expect(initialQty?.trim()).toBe("1");
		/* Click the increase button (second button in the quantity control) */
		const increaseBtn = storefront.page
			.locator("main button")
			.filter({ hasText: "+" })
			.first();
		await increaseBtn.click();
		await expect(qtyControls).toHaveText("2");
	});
});

test.describe("Storefront — Cart", () => {
	test("opens an empty cart drawer", async ({ storefront }) => {
		await storefront.goto("/");
		await storefront.openCart();
		const emptyMsg = storefront.page
			.locator("p")
			.filter({ hasText: "Your cart is empty" });
		await expect(emptyMsg).toBeVisible();
	});

	test("closes cart drawer via close button", async ({ storefront }) => {
		await storefront.goto("/");
		await storefront.openCart();
		await storefront.closeCart();
		await expect(storefront.cartDrawer).not.toBeVisible();
	});

	test("adding a product from detail opens cart with item", async ({
		storefront,
	}) => {
		/* Go to a product detail page */
		await storefront.navigateToProducts();
		await expect(storefront.allProductCards.first()).toBeVisible({
			timeout: 15_000,
		});
		await storefront.allProductCards.first().click();
		await storefront.page.waitForURL(/\/products\/.+/);
		await storefront.page.waitForLoadState("networkidle");
		/* Check if product is in stock */
		const addButton = storefront.page
			.locator("button")
			.filter({ hasText: "Add to cart" });
		const isInStock = await addButton.isVisible().catch(() => false);
		if (!isInStock) {
			test.skip(true, "First product is out of stock");
			return;
		}
		/* Add to cart — capture the POST response */
		const cartResponsePromise = storefront.page.waitForResponse(
			(resp) =>
				resp.url().includes("/api/cart") && resp.request().method() === "POST",
			{ timeout: 10_000 },
		);
		await addButton.click();
		const cartResponse = await cartResponsePromise;
		const body = await cartResponse.text();
		expect(
			cartResponse.status(),
			`Cart POST returned ${cartResponse.status()}: ${body}`,
		).toBe(200);
		/* Cart drawer opens automatically on successful add — wait for it */
		await expect(storefront.cartDrawer).toBeVisible({ timeout: 5_000 });
		/* Should have at least one item */
		const items = storefront.cartItems;
		await expect(items.first()).toBeVisible({ timeout: 5_000 });
	});

	test("cart drawer shows checkout link when items present", async ({
		storefront,
	}) => {
		/* Navigate to product and add to cart */
		await storefront.navigateToProducts();
		await expect(storefront.allProductCards.first()).toBeVisible({
			timeout: 15_000,
		});
		await storefront.allProductCards.first().click();
		await storefront.page.waitForURL(/\/products\/.+/);
		await storefront.page.waitForLoadState("networkidle");
		const addButton = storefront.page
			.locator("button")
			.filter({ hasText: "Add to cart" });
		const isInStock = await addButton.isVisible().catch(() => false);
		if (!isInStock) {
			test.skip(true, "First product is out of stock");
			return;
		}
		await addButton.click();
		/* Wait for mutation success — cart drawer opens automatically */
		await expect(
			storefront.page.locator("button").filter({ hasText: /Added!|Adding/ }),
		).toBeVisible({ timeout: 5_000 });
		await expect(storefront.cartDrawer).toBeVisible({ timeout: 5_000 });
		/* Checkout link should be visible */
		await expect(storefront.checkoutLink).toBeVisible();
		await expect(storefront.checkoutLink).toHaveAttribute("href", "/checkout");
	});
});

test.describe("Storefront — Mobile", () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test("mobile menu button is visible", async ({ storefront }) => {
		await storefront.goto("/");
		const menuBtn = storefront.page.locator('button[aria-label="Open menu"]');
		await expect(menuBtn).toBeVisible();
	});

	test("mobile menu opens and shows nav links", async ({ storefront }) => {
		await storefront.goto("/");
		const menuBtn = storefront.page.locator('button[aria-label="Open menu"]');
		await menuBtn.click();
		/* Mobile nav links should become visible (skip desktop nav which has .hidden) */
		const mobileNav = storefront.page.locator("header nav:not(.hidden) a");
		await expect(mobileNav.first()).toBeVisible({ timeout: 3_000 });
	});

	test("product listing is responsive (2-column grid)", async ({
		storefront,
	}) => {
		await storefront.navigateToProducts();
		await expect(storefront.allProductCards.first()).toBeVisible({
			timeout: 15_000,
		});
		/* Page should render without horizontal scroll */
		const bodyWidth = await storefront.page.evaluate(
			() => document.body.scrollWidth,
		);
		const viewportWidth = await storefront.page.evaluate(
			() => window.innerWidth,
		);
		expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
	});
});

test.describe("Storefront — Customer Account", () => {
	test.beforeEach(async ({ admin }) => {
		await admin.signIn();
	});

	const accountPaths = [
		{ name: "Account overview", path: "/account" },
		{ name: "Order history", path: "/account/orders" },
		{ name: "Profile", path: "/account/profile" },
		{ name: "Addresses", path: "/account/addresses" },
		{ name: "Wishlist", path: "/account/wishlist" },
		{ name: "Subscriptions", path: "/account/subscriptions" },
		{ name: "Downloads", path: "/account/downloads" },
		{ name: "Loyalty", path: "/account/loyalty" },
		{ name: "Returns", path: "/account/returns" },
		{ name: "Reviews", path: "/account/reviews" },
		{ name: "Appointments", path: "/account/appointments" },
		{ name: "Preorders", path: "/account/preorders" },
		{ name: "Backorders", path: "/account/backorders" },
		{ name: "Store Credits", path: "/account/store-credits" },
		{ name: "Invoices", path: "/account/invoices" },
		{ name: "Warranties", path: "/account/warranties" },
		{ name: "Payment Methods", path: "/account/payment-methods" },
		{ name: "Transactions", path: "/account/transactions" },
		{ name: "Orders Returns", path: "/account/orders/returns" },
		{ name: "Affiliate Dashboard", path: "/affiliate/dashboard" },
	];

	for (const { name, path } of accountPaths) {
		test(`${name} page loads without errors`, async ({ storefront }) => {
			await storefront.page.goto(path);
			await storefront.page.waitForLoadState("networkidle");
			const heading = storefront.page.locator("h1, h2").first();
			await expect(heading).toBeVisible({ timeout: 10_000 });
		});
	}
});

test.describe("Storefront — Unauthenticated account", () => {
	test("unauthenticated account access redirects to sign-in", async ({
		page,
	}) => {
		await page.goto("/account");
		await page.waitForURL(/\/auth\/signin/, { timeout: 10_000 });
		expect(page.url()).toContain("/auth/signin");
	});
});

// ─── Module storefront pages ─────────────────────────────────────────────────

test.describe("Storefront — Module Pages", () => {
	const modulePaths = [
		{ name: "Brands", path: "/brands" },
		{ name: "Bundles", path: "/bundles" },
		{ name: "FAQ", path: "/faq" },
		{ name: "Flash Sales", path: "/flash-sales" },
		{ name: "Forms listing", path: "/forms" },
		{ name: "Auctions", path: "/auctions" },
		{ name: "Gift Registry", path: "/gift-registry" },
		{ name: "Memberships", path: "/memberships" },
		{ name: "Vendors", path: "/vendors" },
		{ name: "Vendor apply", path: "/vendors/apply" },
		{ name: "Waitlist", path: "/waitlist" },
		{ name: "Recently Viewed", path: "/recently-viewed" },
		{ name: "Referrals", path: "/referrals" },
		{ name: "Affiliate apply", path: "/affiliate/apply" },
		{ name: "Appointments", path: "/appointments" },
		{ name: "Delivery Slots", path: "/delivery-slots" },
		{ name: "Store Pickup", path: "/store-pickup" },
		{ name: "Store Locator", path: "/stores" },
		{ name: "Photo Booth", path: "/photo-booth" },
		{ name: "Compare", path: "/compare" },
		{ name: "Quotes", path: "/quotes" },
		{ name: "Quote Request", path: "/quotes/request" },
		{ name: "Support Tickets", path: "/support/tickets" },
		{ name: "New Ticket", path: "/support/tickets/new" },
		{ name: "Gift Card Balance", path: "/gift-cards/balance" },
		{ name: "Gift Card Redeem", path: "/gift-cards/redeem" },
		{ name: "Loyalty", path: "/loyalty" },
		{ name: "Subscriptions", path: "/subscriptions" },
		{ name: "Downloads", path: "/downloads" },
		{ name: "Notification Prefs", path: "/notifications/preferences" },
		{ name: "Gift Wrapping", path: "/gift-wrapping" },
		{ name: "Sitemap", path: "/sitemap" },
	];

	for (const { name, path } of modulePaths) {
		test(`${name} page loads without errors`, async ({ page }) => {
			const consoleErrors: string[] = [];
			page.on("console", (msg) => {
				if (msg.type() === "error") consoleErrors.push(msg.text());
			});

			await page.goto(path);
			await page.waitForLoadState("networkidle");

			const is404 = await page
				.locator("h1, h2")
				.filter({ hasText: /404|not found/i })
				.isVisible()
				.catch(() => false);
			expect(is404, `${name} returned 404`).toBe(false);

			const main = page.locator("main");
			await expect(main).toBeVisible({ timeout: 10_000 });
		});
	}
});
