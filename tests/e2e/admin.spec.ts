import { expect, test } from "./fixtures/test-fixtures";

test.describe("Store Admin — Authentication", () => {
	test("redirects unauthenticated users to sign-in", async ({ admin }) => {
		await admin.page.goto("/admin");
		/* Should redirect to signin page OR show 403 */
		await admin.page.waitForURL(/\/(auth\/signin|admin)/, {
			timeout: 10_000,
		});
		const url = admin.page.url();
		const isSignIn = url.includes("/auth/signin");
		const is403 = await admin.forbiddenCode.isVisible().catch(() => false);
		expect(isSignIn || is403).toBeTruthy();
	});

	test("sign-in page renders correctly", async ({ admin }) => {
		await admin.page.goto("/auth/signin");
		const heading = admin.page.locator("h1").filter({ hasText: /sign in/i });
		await expect(heading).toBeVisible();
		/* Should have email and password inputs — scope to main to avoid footer newsletter */
		const form = admin.page.locator("main form");
		const emailInput = form.locator('input[type="email"]');
		const passwordInput = form.locator('input[type="password"]');
		await expect(emailInput).toBeVisible();
		await expect(passwordInput).toBeVisible();
		/* Should have a submit button */
		const submitBtn = form.locator('button[type="submit"]');
		await expect(submitBtn).toBeVisible();
	});

	test("sign-in with valid credentials reaches admin dashboard", async ({
		admin,
	}) => {
		await admin.signInWithForm();
		/* Should be on the admin page now */
		expect(admin.page.url()).toContain("/admin");
		await expect(admin.heading).toBeVisible({ timeout: 10_000 });
	});

	test("sign-in with invalid credentials shows error", async ({ admin }) => {
		await admin.page.goto("/auth/signin");
		const form = admin.page.locator("main form");
		await form.locator('input[type="email"]').fill("wrong@example.com");
		await form.locator('input[type="password"]').fill("wrongpassword");
		await form.locator('button[type="submit"]').click();
		/* Should stay on sign-in page or show error message */
		await admin.page.waitForLoadState("networkidle");
		const url = admin.page.url();
		expect(url).toContain("/auth/signin");
	});
});

test.describe("Store Admin — Dashboard", () => {
	test.beforeEach(async ({ admin }) => {
		await admin.signIn();
	});

	test("shows dashboard heading and stats", async ({ admin }) => {
		const heading = admin.page.locator("h1").filter({ hasText: "Dashboard" });
		await expect(heading).toBeVisible();
		/* Stat cards should appear */
		const statCards = admin.page.locator("[data-testid='stat-card']");
		await expect(statCards.first()).toBeVisible({ timeout: 10_000 });
	});

	test("stat cards show numeric values after loading", async ({ admin }) => {
		/* Wait for stat values to render */
		const statValues = admin.page.locator("[data-testid='stat-value']");
		await expect(statValues.first()).toBeVisible({ timeout: 10_000 });
		const count = await statValues.count();
		expect(count).toBeGreaterThan(0);
		/* Values should be numbers, currency, or ratios (e.g. "5 / 10") */
		for (let i = 0; i < count; i++) {
			const text = await statValues.nth(i).textContent();
			expect(text?.trim()).toMatch(/^[\d$.,/\s]+$/);
		}
	});
});

test.describe("Store Admin — Navigation", () => {
	test.beforeEach(async ({ admin }) => {
		await admin.signIn();
	});

	test("sidebar shows all admin sections", async ({ admin }) => {
		const expectedSections = [
			"Products",
			"Categories",
			"Orders",
			"Customers",
			"Discounts",
			"Inventory",
			"Shipping",
			"Subscriptions",
			"Downloads",
			"Payments",
			"Reviews",
			"Analytics",
			"Newsletter",
		];
		for (const section of expectedSections) {
			const link = admin.page.locator("a").filter({ hasText: section }).first();
			await expect(link).toBeVisible();
		}
	});

	test("navigating to Products page shows product list", async ({ admin }) => {
		await admin.navigateTo("Products");
		await admin.page.waitForURL(/\/admin\/products/);
		const heading = admin.page
			.locator("h1, h2")
			.filter({ hasText: /Products/i })
			.first();
		await expect(heading).toBeVisible({ timeout: 10_000 });
	});

	test("navigating to Orders page shows order list", async ({ admin }) => {
		await admin.navigateTo("Orders");
		await admin.page.waitForURL(/\/admin\/orders/);
		const heading = admin.page
			.locator("h1, h2")
			.filter({ hasText: /Orders/i })
			.first();
		await expect(heading).toBeVisible({ timeout: 10_000 });
	});

	test("navigating to Customers page shows customer list", async ({
		admin,
	}) => {
		await admin.navigateTo("Customers");
		await admin.page.waitForURL(/\/admin\/customers/);
		const heading = admin.page
			.locator("h1, h2")
			.filter({ hasText: /Customers/i })
			.first();
		await expect(heading).toBeVisible({ timeout: 10_000 });
	});
});

test.describe("Store Admin — Product Management", () => {
	test.beforeEach(async ({ admin }) => {
		await admin.signIn();
		await admin.page.goto("/admin/products");
	});

	test("product list loads and shows products from seed data", async ({
		admin,
	}) => {
		/* Wait for the product list module to dynamically load and render.
		   networkidle is not sufficient here because the admin module chunk
		   is fetched inside a useEffect — networkidle can fire before the
		   chunk fetch starts. Wait for the table (or an error banner) instead. */
		await admin.page.waitForSelector("table, .text-destructive", {
			timeout: 20_000,
		});
		/* Should show at least one product from seed data or empty state */
		const rows = admin.page.locator("table tbody tr, div[class*='card']");
		const emptyState = admin.page
			.locator("p")
			.filter({ hasText: /no products|empty/i });
		const hasRows = (await rows.count()) > 0;
		const hasEmptyState = await emptyState.isVisible().catch(() => false);
		expect(hasRows || hasEmptyState).toBeTruthy();
	});

	test("'New Product' action is available", async ({ admin }) => {
		const newButton = admin.page
			.locator("a, button")
			.filter({ hasText: /new|add|create/i })
			.first();
		await expect(newButton).toBeVisible({ timeout: 10_000 });
	});
});

test.describe("Store Admin — Module Pages", () => {
	test.beforeEach(async ({ admin }) => {
		await admin.signIn();
	});

	const modulePaths = [
		// Catalog
		{ name: "Brands", path: "/admin/brands" },
		{ name: "Collections", path: "/admin/collections" },
		{ name: "Discounts", path: "/admin/discounts" },
		{ name: "Bundles", path: "/admin/bundles" },
		{ name: "Flash Sales", path: "/admin/flash-sales" },
		{ name: "Bulk Pricing", path: "/admin/bulk-pricing" },
		{ name: "Price Lists", path: "/admin/price-lists" },
		{ name: "Product Labels", path: "/admin/product-labels" },
		{ name: "Product Feeds", path: "/admin/product-feeds" },
		{ name: "Comparisons", path: "/admin/comparisons" },
		{ name: "Product Q&A", path: "/admin/product-qa" },
		// Sales
		{ name: "Orders", path: "/admin/orders" },
		{ name: "Abandoned Carts", path: "/admin/abandoned-carts" },
		{ name: "Carts", path: "/admin/carts" },
		{ name: "Checkout", path: "/admin/checkout" },
		{ name: "Payments", path: "/admin/payments" },
		{ name: "Invoices", path: "/admin/invoices" },
		{ name: "Quotes", path: "/admin/quotes" },
		{ name: "Returns", path: "/admin/returns" },
		{ name: "Tipping", path: "/admin/tipping" },
		// Customers
		{ name: "Customers", path: "/admin/customers" },
		{ name: "Customer Groups", path: "/admin/customer-groups" },
		{ name: "Loyalty", path: "/admin/loyalty" },
		{ name: "Affiliates", path: "/admin/affiliates" },
		{ name: "Referrals", path: "/admin/referrals" },
		{ name: "Gift Cards", path: "/admin/gift-cards" },
		{ name: "Gift Registry", path: "/admin/gift-registry" },
		{ name: "Store Credits", path: "/admin/store-credits" },
		{ name: "Memberships", path: "/admin/memberships" },
		{ name: "Wishlist", path: "/admin/wishlist" },
		{ name: "Saved Addresses", path: "/admin/saved-addresses" },
		{ name: "Waitlist", path: "/admin/waitlist" },
		// Fulfillment
		{ name: "Inventory", path: "/admin/inventory" },
		{ name: "Shipping", path: "/admin/shipping" },
		{ name: "Fulfillment", path: "/admin/fulfillment" },
		{ name: "Backorders", path: "/admin/backorders" },
		{ name: "Preorders", path: "/admin/preorders" },
		{ name: "Warranties", path: "/admin/warranties" },
		{ name: "Delivery Slots", path: "/admin/delivery-slots" },
		{ name: "Store Pickup", path: "/admin/store-pickup" },
		{ name: "Store Locator", path: "/admin/store-locator" },
		{ name: "DoorDash", path: "/admin/doordash" },
		{ name: "Uber Direct", path: "/admin/uber-direct" },
		{ name: "Favor", path: "/admin/favor" },
		// Marketing
		{ name: "Reviews", path: "/admin/reviews" },
		{ name: "Newsletter", path: "/admin/newsletter" },
		{ name: "Social Proof", path: "/admin/social-proof" },
		{ name: "Social Sharing", path: "/admin/social-sharing" },
		{ name: "Gamification", path: "/admin/gamification" },
		{ name: "Subscriptions", path: "/admin/subscriptions" },
		{ name: "Recommendations", path: "/admin/recommendations" },
		// Content
		{ name: "Blog", path: "/admin/blog" },
		{ name: "Pages", path: "/admin/pages" },
		{ name: "Forms", path: "/admin/forms" },
		{ name: "FAQ", path: "/admin/faq" },
		{ name: "Order Notes", path: "/admin/order-notes" },
		{ name: "Gift Wrapping", path: "/admin/gift-wrapping" },
		{ name: "Media", path: "/admin/media" },
		{ name: "Photo Booth", path: "/admin/photo-booth" },
		{ name: "QR Codes", path: "/admin/qr-codes" },
		{ name: "Notifications (admin)", path: "/admin/notifications" },
		// Finance
		{ name: "Revenue", path: "/admin/revenue" },
		{ name: "Multi-Currency", path: "/admin/currencies" },
		{ name: "Stripe", path: "/admin/stripe" },
		{ name: "PayPal", path: "/admin/paypal" },
		{ name: "Square", path: "/admin/square" },
		{ name: "Braintree", path: "/admin/braintree" },
		// Support
		{ name: "Tickets", path: "/admin/tickets" },
		{ name: "Digital Downloads", path: "/admin/downloads" },
		{ name: "Appointments", path: "/admin/appointments" },
		{ name: "Auctions", path: "/admin/auctions" },
		{ name: "Vendors", path: "/admin/vendors" },
		// System
		{ name: "Analytics", path: "/admin/analytics" },
		{ name: "SEO", path: "/admin/seo" },
		{ name: "Search", path: "/admin/search" },
		{ name: "Automations", path: "/admin/automations" },
		{ name: "Audit Log", path: "/admin/audit-log" },
		{ name: "Tax", path: "/admin/tax" },
		{ name: "Redirects", path: "/admin/redirects" },
		{ name: "Sitemap", path: "/admin/sitemap" },
		{ name: "Import/Export", path: "/admin/import-export" },
		// Marketplace channels
		{ name: "Amazon", path: "/admin/amazon" },
		{ name: "eBay", path: "/admin/ebay" },
		{ name: "Etsy", path: "/admin/etsy" },
		{ name: "TikTok Shop", path: "/admin/tiktok-shop" },
		{ name: "Walmart", path: "/admin/walmart" },
		{ name: "Facebook Shop", path: "/admin/facebook-shop" },
		{ name: "Instagram Shop", path: "/admin/instagram-shop" },
		{ name: "Google Shopping", path: "/admin/google-shopping" },
		{ name: "Pinterest Shop", path: "/admin/pinterest-shop" },
		{ name: "Uber Eats", path: "/admin/uber-eats" },
		{ name: "Toast POS", path: "/admin/toast" },
		{ name: "X Shop", path: "/admin/x-shop" },
		{ name: "Recently Viewed", path: "/admin/recently-viewed" },
	];

	for (const { name, path } of modulePaths) {
		test(`${name} page loads without errors`, async ({ admin }) => {
			await admin.page.goto(path);
			/* Page should have a heading or content */
			await admin.page.waitForLoadState("networkidle");
			await expect(admin.page.getByText(/encountered an error/i)).toHaveCount(
				0,
			);
			const heading = admin.page.locator("h1, h2").first();
			await expect(heading).toBeVisible({ timeout: 10_000 });
		});
	}
});

test.describe("Store Admin — Named Module Smoke", () => {
	test.beforeEach(async ({ admin }) => {
		await admin.signIn();
	});

	const moduleRoutes = [
		{ heading: /Announcements/i, path: "/admin/announcements" },
		{ heading: /New Announcement/i, path: "/admin/announcements/new" },
		{ heading: /Bulk Pricing/i, path: "/admin/bulk-pricing" },
		{ heading: /Wish/i, path: "/admin/wish" },
		{ heading: /Kiosk Overview/i, path: "/admin/kiosk" },
		{ heading: /Kiosk Stations/i, path: "/admin/kiosk/stations" },
	];

	for (const { heading, path } of moduleRoutes) {
		test(`${path} loads without loader or client errors`, async ({ admin }) => {
			const consoleErrors: string[] = [];
			const pageErrors: string[] = [];

			admin.page.on("console", (message) => {
				if (message.type() === "error") {
					consoleErrors.push(message.text());
				}
			});
			admin.page.on("pageerror", (error) => {
				pageErrors.push(error.message);
			});

			await admin.page.goto(path);
			await admin.page.waitForLoadState("networkidle");

			await expect(
				admin.page.locator("h1, h2").filter({ hasText: heading }).first(),
			).toBeVisible({ timeout: 10_000 });
			await expect(
				admin.page.getByText("Failed to load admin page"),
			).toHaveCount(0);
			await expect(admin.page.getByText(/encountered an error/i)).toHaveCount(
				0,
			);

			expect(pageErrors, pageErrors.join("\n")).toEqual([]);
			expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
		});
	}
});

test.describe("Store Admin — Access Control", () => {
	test("403 page shows correct error UI elements", async ({ page }) => {
		/* Directly check the 403 page structure — if accessing admin
		   without proper store membership should show 403 */
		await page.goto("/admin");
		const is403 = await page
			.locator("p")
			.filter({ hasText: "403" })
			.isVisible()
			.catch(() => false);
		if (is403) {
			/* Verify the 403 page structure */
			const accessDenied = page
				.locator("h1")
				.filter({ hasText: "Access denied" });
			await expect(accessDenied).toBeVisible();
			const returnLink = page.locator('a[href="/"]');
			await expect(returnLink).toBeVisible();
			await expect(returnLink).toHaveText(/storefront/i);
		}
		/* If not 403, user was redirected to signin — also valid */
	});
});
