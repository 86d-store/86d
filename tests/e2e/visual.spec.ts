import { expect } from "@playwright/test";
import { getDeterministicAdminVisualResponse } from "./admin-visual-data";
import { test } from "./fixtures/test-fixtures";
import { createVisualApiTracker } from "./visual-api-tracker";

/**
 * Visual regression tests — screenshot comparison across viewports.
 * Run with `bun test:e2e` (uses store-chromium by default).
 * To regenerate snapshots: `bun test:e2e --update-snapshots`
 *
 * Viewport-specific runs:
 *   playwright test visual.spec.ts --project=visual-desktop
 *   playwright test visual.spec.ts --project=visual-tablet
 *   playwright test visual.spec.ts --project=visual-mobile
 *
 * Dark mode runs:
 *   playwright test visual.spec.ts --project=visual-dark-desktop
 *   playwright test visual.spec.ts --project=visual-dark-tablet
 *   playwright test visual.spec.ts --project=visual-dark-mobile
 */

/** Hide the Next.js dev overlay in screenshots. */
const DEV_OVERLAY_CSS =
	"nextjs-portal { display: none !important; } " +
	"body > [style*='fixed'] > button[aria-label] { display: none !important; }";

const SCREENSHOT_OPTS = {
	fullPage: true,
	maxDiffPixelRatio: 0.005,
	style: DEV_OVERLAY_CSS,
	threshold: 0.15,
};

const VISUAL_FIXED_TIME = new Date("2026-08-25T12:00:00.000Z");
const VISUAL_COPYRIGHT_YEAR = "2026";

const visualApiTrackers = new WeakMap<
	import("@playwright/test").Page,
	ReturnType<typeof createVisualApiTracker>
>();

function installFailClosedVisualGuard(
	page: import("@playwright/test").Page,
	baseURL: string | undefined,
) {
	if (!baseURL) throw new Error("Visual tests require a configured baseURL");
	const tracker = createVisualApiTracker(baseURL);
	visualApiTrackers.set(page, tracker);

	page.on("request", (request) => {
		tracker.started(request, {
			method: request.method(),
			url: request.url(),
		});
	});

	page.on("response", (response) => {
		tracker.responded(response.request(), response.status());
	});

	page.on("requestfinished", (request) => {
		tracker.finished(request);
	});

	page.on("requestfailed", (request) => {
		tracker.failed(
			request,
			request.failure()?.errorText ?? "request failed without an error",
		);
	});
}

function beginVisualApiPhase(page: import("@playwright/test").Page) {
	const tracker = visualApiTrackers.get(page);
	if (!tracker) throw new Error("Visual API tracker is not installed");
	tracker.beginPhase();
}

async function installDeterministicVisualWrites(
	page: import("@playwright/test").Page,
) {
	await page.route("**/api/analytics/events", async (route) => {
		if (route.request().method() !== "POST") {
			await route.continue();
			return;
		}
		await route.fulfill({
			json: {
				event: {
					id: "visual_event_001",
					type: "pageView",
					data: {},
					createdAt: VISUAL_FIXED_TIME.toISOString(),
				},
			},
		});
	});
}

const ADMIN_CLOCKED_VISUALS = new Set([
	"admin dashboard",
	"admin orders page",
	"admin customers page",
]);

async function installDeterministicAdminVisualData(
	page: import("@playwright/test").Page,
) {
	await page.route("**/api/admin/**", async (route) => {
		if (route.request().method() !== "GET") {
			await route.continue();
			return;
		}
		const url = new URL(route.request().url());
		const response = getDeterministicAdminVisualResponse(url.pathname, url);
		if (!response) {
			await route.continue();
			return;
		}
		await route.fulfill({ json: response });
	});
}

/** Navigate to a page and wait for it to fully settle. */
async function stableGoto(page: import("@playwright/test").Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState("load");
	const copyright = page
		.locator("footer span")
		.filter({ hasText: /©\s+\d{4}/ })
		.first();
	if ((await copyright.count()) > 0) {
		await copyright.evaluate((node, year) => {
			node.textContent = node.textContent?.replace(/\b\d{4}\b/, year) ?? "";
		}, VISUAL_COPYRIGHT_YEAR);
	}
}

test.beforeEach(async ({ page }, testInfo) => {
	installFailClosedVisualGuard(page, testInfo.project.use.baseURL);
	await installDeterministicVisualWrites(page);
});

test.afterEach(async ({ page }) => {
	const tracker = visualApiTrackers.get(page);
	if (!tracker) {
		throw new Error("Visual API tracker is not installed");
	}
	await expect
		.poll(() => tracker.pendingIssues(), {
			message: "Visual API requests must settle before teardown",
			timeout: 10_000,
		})
		.toEqual([]);
	const apiFailures = tracker.issues();
	visualApiTrackers.delete(page);
	const moduleBoundaries = await page
		.getByText(/^Module "[^"]+" encountered an error$/)
		.allTextContents();
	const runtimeFailures = [
		...apiFailures.map(
			({ method, path, failure }) => `${method} ${path}: ${failure}`,
		),
		...moduleBoundaries.map(
			(text) => `Rendered error boundary: ${text.trim()}`,
		),
	];

	expect(
		runtimeFailures,
		"Visual runtime failures must block snapshots",
	).toEqual([]);
});

// ─── Core storefront pages ──────────────────────────────────────────────────

test.describe("Storefront — Visual", () => {
	test("homepage", async ({ page }) => {
		await stableGoto(page, "/");
		await expect(page.locator("header")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("homepage.png", SCREENSHOT_OPTS);
	});

	test("product listing", async ({ page }) => {
		await stableGoto(page, "/products");
		await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
		await expect(page).toHaveScreenshot("products.png", SCREENSHOT_OPTS);
	});

	test("about page", async ({ page }) => {
		await stableGoto(page, "/about");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("about.png", SCREENSHOT_OPTS);
	});

	test("contact page", async ({ page }) => {
		await stableGoto(page, "/contact");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("contact.png", SCREENSHOT_OPTS);
	});

	test("collections page", async ({ page }) => {
		await stableGoto(page, "/collections");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("collections.png", SCREENSHOT_OPTS);
	});

	test("search page", async ({ page }) => {
		await stableGoto(page, "/search");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("search.png", SCREENSHOT_OPTS);
	});

	test("blog page", async ({ page }) => {
		await stableGoto(page, "/blog");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("blog.png", SCREENSHOT_OPTS);
	});

	test("blog post detail", async ({ page }) => {
		await stableGoto(page, "/blog/inside-the-atelier");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("blog-post.png", SCREENSHOT_OPTS);
	});

	test("product detail", async ({ page }) => {
		await stableGoto(page, "/products/regent-penny-loafer");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("product-detail.png", SCREENSHOT_OPTS);
	});

	test("gift cards page", async ({ page }) => {
		await stableGoto(page, "/gift-cards");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("gift-cards.png", SCREENSHOT_OPTS);
	});

	test("privacy page", async ({ page }) => {
		await stableGoto(page, "/privacy");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("privacy.png", SCREENSHOT_OPTS);
	});

	test("terms page", async ({ page }) => {
		await stableGoto(page, "/terms");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("terms.png", SCREENSHOT_OPTS);
	});

	test("order tracking page", async ({ page }) => {
		await stableGoto(page, "/track");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("track.png", SCREENSHOT_OPTS);
	});

	test("brands page", async ({ page }) => {
		await stableGoto(page, "/brands");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("brands.png", SCREENSHOT_OPTS);
	});

	test("bundles page", async ({ page }) => {
		await stableGoto(page, "/bundles");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("bundles.png", SCREENSHOT_OPTS);
	});

	test("faq page", async ({ page }) => {
		await stableGoto(page, "/faq");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("faq.png", SCREENSHOT_OPTS);
	});

	test("flash sales page", async ({ page }) => {
		await stableGoto(page, "/flash-sales");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("flash-sales.png", SCREENSHOT_OPTS);
	});

	test("forms page", async ({ page }) => {
		await stableGoto(page, "/forms");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("forms.png", SCREENSHOT_OPTS);
	});

	test("auctions page", async ({ page }) => {
		await stableGoto(page, "/auctions");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("auctions.png", SCREENSHOT_OPTS);
	});

	test("gift registry page", async ({ page }) => {
		await stableGoto(page, "/gift-registry");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("gift-registry.png", SCREENSHOT_OPTS);
	});

	test("memberships page", async ({ page }) => {
		await stableGoto(page, "/memberships");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("memberships.png", SCREENSHOT_OPTS);
	});

	test("vendors page", async ({ page }) => {
		await stableGoto(page, "/vendors");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("vendors.png", SCREENSHOT_OPTS);
	});

	test("vendor apply page", async ({ page }) => {
		await stableGoto(page, "/vendors/apply");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("vendors-apply.png", SCREENSHOT_OPTS);
	});

	test("waitlist page", async ({ page }) => {
		await stableGoto(page, "/waitlist");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("waitlist.png", SCREENSHOT_OPTS);
	});

	test("recently viewed page", async ({ page }) => {
		await stableGoto(page, "/recently-viewed");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("recently-viewed.png", SCREENSHOT_OPTS);
	});

	test("referrals page", async ({ page }) => {
		await stableGoto(page, "/referrals");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("referrals.png", SCREENSHOT_OPTS);
	});

	test("affiliate apply page", async ({ page }) => {
		await stableGoto(page, "/affiliate/apply");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("affiliate-apply.png", SCREENSHOT_OPTS);
	});

	test("appointments page", async ({ page }) => {
		await page.clock.setFixedTime(VISUAL_FIXED_TIME);
		await stableGoto(page, "/appointments");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("appointments.png", SCREENSHOT_OPTS);
	});

	test("delivery slots page", async ({ page }) => {
		await page.clock.setFixedTime(VISUAL_FIXED_TIME);
		await stableGoto(page, "/delivery-slots");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("delivery-slots.png", SCREENSHOT_OPTS);
	});

	test("store pickup page", async ({ page }) => {
		await page.clock.setFixedTime(VISUAL_FIXED_TIME);
		await stableGoto(page, "/store-pickup");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("store-pickup.png", SCREENSHOT_OPTS);
	});

	test("store locator page", async ({ page }) => {
		await stableGoto(page, "/stores");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("store-locator.png", SCREENSHOT_OPTS);
	});

	test("photo booth page", async ({ page }) => {
		await stableGoto(page, "/photo-booth");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("photo-booth.png", SCREENSHOT_OPTS);
	});

	test("compare page", async ({ page }) => {
		await stableGoto(page, "/compare");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("compare.png", SCREENSHOT_OPTS);
	});

	test("quotes page", async ({ page }) => {
		await stableGoto(page, "/quotes");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("quotes.png", SCREENSHOT_OPTS);
	});

	test("quote request page", async ({ page }) => {
		await stableGoto(page, "/quotes/request");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("quotes-request.png", SCREENSHOT_OPTS);
	});

	test("support tickets page", async ({ page }) => {
		await stableGoto(page, "/support/tickets");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("support-tickets.png", SCREENSHOT_OPTS);
	});

	test("new support ticket page", async ({ page }) => {
		await stableGoto(page, "/support/tickets/new");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot(
			"support-tickets-new.png",
			SCREENSHOT_OPTS,
		);
	});

	test("gift card balance page", async ({ page }) => {
		await stableGoto(page, "/gift-cards/balance");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot(
			"gift-cards-balance.png",
			SCREENSHOT_OPTS,
		);
	});

	test("gift card redeem page", async ({ page }) => {
		await stableGoto(page, "/gift-cards/redeem");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot(
			"gift-cards-redeem.png",
			SCREENSHOT_OPTS,
		);
	});

	test("loyalty page", async ({ page }) => {
		await stableGoto(page, "/loyalty");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("loyalty.png", SCREENSHOT_OPTS);
	});

	test("subscriptions page", async ({ page }) => {
		await stableGoto(page, "/subscriptions");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("subscriptions.png", SCREENSHOT_OPTS);
	});

	test("digital downloads page", async ({ page }) => {
		await stableGoto(page, "/downloads");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("downloads.png", SCREENSHOT_OPTS);
	});

	test("notifications preferences page", async ({ page }) => {
		await stableGoto(page, "/notifications/preferences");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot(
			"notifications-preferences.png",
			SCREENSHOT_OPTS,
		);
	});

	test("gift wrapping page", async ({ page }) => {
		await stableGoto(page, "/gift-wrapping");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("gift-wrapping.png", SCREENSHOT_OPTS);
	});

	test("sitemap page", async ({ page }) => {
		await stableGoto(page, "/sitemap");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("sitemap.png", SCREENSHOT_OPTS);
	});

	test("kiosk terminal containment", async ({ page }) => {
		await stableGoto(page, "/kiosk/visual-station");
		await expect(page.getByTestId("kiosk-unavailable")).toBeVisible();
		await expect(page.getByRole("button", { name: "Start order" })).toHaveCount(
			0,
		);
		await expect(page).toHaveScreenshot(
			"kiosk-terminal-containment.png",
			SCREENSHOT_OPTS,
		);
	});
});

// ─── Auth pages ─────────────────────────────────────────────────────────────

test.describe("Auth — Visual", () => {
	test("signin page", async ({ page }) => {
		await stableGoto(page, "/auth/signin");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("auth-signin.png", SCREENSHOT_OPTS);
	});

	test("signup page", async ({ page }) => {
		await stableGoto(page, "/auth/signup");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("auth-signup.png", SCREENSHOT_OPTS);
	});
});

// ─── Cart page ──────────────────────────────────────────────────────────────

test.describe("Cart — Visual", () => {
	test("cart page (empty)", async ({ page }) => {
		await stableGoto(page, "/cart");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("cart-empty.png", SCREENSHOT_OPTS);
	});
});

// ─── Checkout ───────────────────────────────────────────────────────────────

test.describe("Checkout — Visual", () => {
	test("checkout page (empty cart)", async ({ page }) => {
		await stableGoto(page, "/checkout");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("checkout-empty.png", SCREENSHOT_OPTS);
	});

	test("order confirmation page", async ({ page }) => {
		await stableGoto(page, "/checkout/confirmation");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot(
			"checkout-confirmation.png",
			SCREENSHOT_OPTS,
		);
	});
});

// ─── Error pages ────────────────────────────────────────────────────────────

test.describe("Error — Visual", () => {
	test("404 not found", async ({ page }) => {
		await stableGoto(page, "/this-page-does-not-exist");
		await expect(page).toHaveScreenshot("not-found.png", SCREENSHOT_OPTS);
	});
});

// ─── Cart drawer ────────────────────────────────────────────────────────────

test.describe("Storefront — Cart drawer", () => {
	test("cart drawer open", async ({ page }) => {
		await stableGoto(page, "/");
		const cartButton = page.locator('button[aria-label*="Cart"]');
		await cartButton.click();
		await expect(
			page.locator('[role="dialog"][aria-label="Shopping cart"]'),
		).toBeVisible({ timeout: 5_000 });
		await expect(page).toHaveScreenshot("cart-drawer.png", SCREENSHOT_OPTS);
	});
});

// ─── Admin pages ────────────────────────────────────────────────────────────

test.describe("Admin — Visual", () => {
	test("admin login page", async ({ page }) => {
		await stableGoto(page, "/admin");
		await expect(page).toHaveScreenshot("admin.png", SCREENSHOT_OPTS);
	});
});

// ─── Authenticated admin pages ───────────────────────────────────────────────

test.describe("Admin — Authenticated Visual", () => {
	test.beforeEach(async ({ admin }, testInfo) => {
		await installDeterministicAdminVisualData(admin.page);
		if (ADMIN_CLOCKED_VISUALS.has(testInfo.title)) {
			await admin.page.clock.setFixedTime(VISUAL_FIXED_TIME);
		}
		await admin.applyStoredAdminSession();
		beginVisualApiPhase(admin.page);
	});

	test("admin dashboard", async ({ admin }) => {
		await admin.page.goto("/admin");
		await expect(
			admin.page.getByText("#VISUAL-001", { exact: true }),
		).toBeVisible();
		await expect(
			admin.page.getByText("House Blend Coffee", { exact: true }),
		).toBeVisible();
		await expect(admin.page).toHaveScreenshot(
			"admin-dashboard.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin products page", async ({ admin }) => {
		await admin.page.goto("/admin/products");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-products.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin orders page", async ({ admin }) => {
		await admin.page.goto("/admin/orders");
		await expect(
			admin.page.getByText("VISUAL-001", { exact: true }),
		).toBeVisible();
		await expect(admin.page).toHaveScreenshot(
			"admin-orders.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin customers page", async ({ admin }) => {
		await admin.page.goto("/admin/customers");
		await expect(
			admin.page.getByText("visual@example.com", { exact: true }),
		).toBeVisible();
		await expect(admin.page).toHaveScreenshot(
			"admin-customers.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin announcements list", async ({ admin }) => {
		await admin.page.goto("/admin/announcements");
		await admin.page.waitForLoadState("load");
		const main = admin.page.locator("#admin-main");
		await expect(
			main.getByText("No announcements yet", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(main.getByText("Click rate", { exact: true })).toBeVisible({
			timeout: 15_000,
		});
		await expect(admin.page).toHaveScreenshot(
			"admin-announcements-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin announcements new form", async ({ admin }) => {
		await admin.page.goto("/admin/announcements/new");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-announcements-new.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Discounts (backfill — previously uncovered) ─────────────────────────

	test("admin discounts list", async ({ admin }) => {
		await admin.page.goto("/admin/discounts");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-discounts-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin discounts analytics", async ({ admin }) => {
		await admin.page.goto("/admin/discounts/analytics");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-discounts-analytics.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin reviews list", async ({ admin }) => {
		await admin.page.goto("/admin/reviews");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-reviews-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin inventory list", async ({ admin }) => {
		await admin.page.goto("/admin/inventory");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-inventory-list.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Payment & fulfillment admin screens (backfill) ──────────────────────

	test("admin stripe settings", async ({ admin }) => {
		await admin.page.goto("/admin/stripe");
		await expect(
			admin.page.getByText("Supported Events", { exact: true }),
		).toBeVisible();
		await expect(admin.page).toHaveScreenshot(
			"admin-stripe-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin shipping rates", async ({ admin }) => {
		await admin.page.goto("/admin/shipping");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-shipping-rates.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin tax configuration", async ({ admin }) => {
		await admin.page.goto("/admin/tax");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-tax-config.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin checkout sessions", async ({ admin }) => {
		await admin.page.goto("/admin/checkout");
		await expect(
			admin.page.getByText("No checkout sessions found", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(
			admin.page.getByText("Total Sessions", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(admin.page).toHaveScreenshot(
			"admin-checkout-sessions.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin blog posts", async ({ admin }) => {
		await admin.page.goto("/admin/blog");
		await expect(
			admin.page
				.locator("#admin-main")
				.getByText("No posts found", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(admin.page).toHaveScreenshot(
			"admin-blog-posts.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin discounts price rules", async ({ admin }) => {
		await admin.page.goto("/admin/discounts/price-rules");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-discounts-price-rules.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin loyalty program", async ({ admin }) => {
		await admin.page.goto("/admin/loyalty");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-loyalty.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin gift cards", async ({ admin }) => {
		await admin.page.goto("/admin/gift-cards");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-gift-cards.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin collections list", async ({ admin }) => {
		await admin.page.goto("/admin/collections");
		const main = admin.page.locator("#admin-main");
		await expect(
			main.getByText("No collections found", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(main.getByText("Products", { exact: true })).toBeVisible({
			timeout: 15_000,
		});
		await expect(admin.page).toHaveScreenshot(
			"admin-collections-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin brands list", async ({ admin }) => {
		await admin.page.goto("/admin/brands");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-brands-list.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Sales & Scheduling ──────────────────────────────────────────────────

	test("admin subscriptions list", async ({ admin }) => {
		await admin.page.goto("/admin/subscriptions");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-subscriptions-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin returns list", async ({ admin }) => {
		await admin.page.goto("/admin/returns");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-returns-list.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Customers & Programs ────────────────────────────────────────────────

	test("admin vendors list", async ({ admin }) => {
		await admin.page.goto("/admin/vendors");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-vendors-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin memberships list", async ({ admin }) => {
		await admin.page.goto("/admin/memberships");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-memberships-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin store credits list", async ({ admin }) => {
		await admin.page.goto("/admin/store-credits");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-store-credits-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin customer groups list", async ({ admin }) => {
		await admin.page.goto("/admin/customer-groups");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-customer-groups-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin referrals list", async ({ admin }) => {
		await admin.page.goto("/admin/referrals");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-referrals-list.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Fulfillment ─────────────────────────────────────────────────────────

	test("admin preorders list", async ({ admin }) => {
		await admin.page.goto("/admin/preorders");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-preorders-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin backorders list", async ({ admin }) => {
		await admin.page.goto("/admin/backorders");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-backorders-list.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Marketing & Engagement ──────────────────────────────────────────────

	test("admin newsletter list", async ({ admin }) => {
		await admin.page.goto("/admin/newsletter");
		await expect(
			admin.page
				.locator("#admin-main")
				.getByText("No subscribers found", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(admin.page).toHaveScreenshot(
			"admin-newsletter-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin waitlist list", async ({ admin }) => {
		await admin.page.goto("/admin/waitlist");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-waitlist-list.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Content & Site ──────────────────────────────────────────────────────

	test("admin forms list", async ({ admin }) => {
		await admin.page.goto("/admin/forms");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-forms-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin faq list", async ({ admin }) => {
		await admin.page.goto("/admin/faq");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-faq-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin navigation list", async ({ admin }) => {
		await admin.page.goto("/admin/navigation");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-navigation-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin media library", async ({ admin }) => {
		await admin.page.goto("/admin/media");
		await expect(
			admin.page
				.locator("#admin-main")
				.getByText("No assets found", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(admin.page).toHaveScreenshot(
			"admin-media-library.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin seo settings", async ({ admin }) => {
		await admin.page.goto("/admin/seo");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-seo-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Finance & System ────────────────────────────────────────────────────

	test("admin revenue overview", async ({ admin }) => {
		await admin.page.goto("/admin/revenue");
		await expect(
			admin.page.getByText("Total Revenue", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(
			admin.page.getByText("By Status", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(admin.page).toHaveScreenshot(
			"admin-revenue-overview.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin analytics overview", async ({ admin }) => {
		await admin.page.goto("/admin/analytics");
		await expect(
			admin.page.getByText("Total Events", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(admin.page.getByText("Loading…", { exact: true })).toBeHidden({
			timeout: 15_000,
		});
		await expect(admin.page).toHaveScreenshot(
			"admin-analytics-overview.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin automations list", async ({ admin }) => {
		await admin.page.goto("/admin/automations");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-automations-list.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Support ─────────────────────────────────────────────────────────────

	test("admin tickets list", async ({ admin }) => {
		await admin.page.goto("/admin/tickets");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-tickets-list.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Catalog (backfill) ──────────────────────────────────────────────────

	test("admin categories list", async ({ admin }) => {
		await admin.page.goto("/admin/categories");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-categories-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin bundles list", async ({ admin }) => {
		await admin.page.goto("/admin/bundles");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-bundles-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin price lists", async ({ admin }) => {
		await admin.page.goto("/admin/price-lists");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-price-lists.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin product labels", async ({ admin }) => {
		await admin.page.goto("/admin/product-labels");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-product-labels.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin product Q&A", async ({ admin }) => {
		await admin.page.goto("/admin/product-qa");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-product-qa.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin comparisons", async ({ admin }) => {
		await admin.page.goto("/admin/comparisons");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-comparisons.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Sales (backfill) ────────────────────────────────────────────────────

	test("admin carts list", async ({ admin }) => {
		await admin.page.goto("/admin/carts");
		await expect(
			admin.page.getByText("No carts found", { exact: true }),
		).toBeVisible();
		await expect(admin.page).toHaveScreenshot(
			"admin-carts-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin abandoned carts list", async ({ admin }) => {
		await admin.page.goto("/admin/abandoned-carts");
		await expect(
			admin.page.getByText("No abandoned carts found.", { exact: true }),
		).toBeVisible();
		await expect(
			admin.page.getByText("Recovery Rate", { exact: true }),
		).toBeVisible();
		await expect(admin.page).toHaveScreenshot(
			"admin-abandoned-carts-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin payments list", async ({ admin }) => {
		await admin.page.goto("/admin/payments");
		await expect(
			admin.page
				.locator("#admin-main")
				.getByText("No payment intents found", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(admin.page).toHaveScreenshot(
			"admin-payments-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin invoices list", async ({ admin }) => {
		await admin.page.goto("/admin/invoices");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-invoices-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin flash sales list", async ({ admin }) => {
		await admin.page.goto("/admin/flash-sales");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-flash-sales-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin auctions list", async ({ admin }) => {
		await admin.page.goto("/admin/auctions");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-auctions-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin quotes list", async ({ admin }) => {
		await admin.page.goto("/admin/quotes");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-quotes-list.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Fulfillment (backfill) ──────────────────────────────────────────────

	test("admin appointments list", async ({ admin }) => {
		await admin.page.goto("/admin/appointments");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-appointments-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin gift wrapping settings", async ({ admin }) => {
		await admin.page.goto("/admin/gift-wrapping");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-gift-wrapping.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin gift registry list", async ({ admin }) => {
		await admin.page.goto("/admin/gift-registry");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-gift-registry-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin warranties list", async ({ admin }) => {
		await admin.page.goto("/admin/warranties");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-warranties-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin fulfillment overview", async ({ admin }) => {
		await admin.page.goto("/admin/fulfillment");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-fulfillment-overview.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin store pickup queue", async ({ admin }) => {
		await admin.page.goto("/admin/store-pickup");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-store-pickup.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin delivery slots list", async ({ admin }) => {
		await admin.page.goto("/admin/delivery-slots");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-delivery-slots.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Marketing (backfill) ────────────────────────────────────────────────

	test("admin social proof list", async ({ admin }) => {
		await admin.page.goto("/admin/social-proof");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-social-proof-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin recommendations settings", async ({ admin }) => {
		await admin.page.goto("/admin/recommendations");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-recommendations.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin social sharing settings", async ({ admin }) => {
		await admin.page.goto("/admin/social-sharing");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-social-sharing.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Content (backfill) ──────────────────────────────────────────────────

	test("admin cms pages list", async ({ admin }) => {
		await admin.page.goto("/admin/pages");
		await expect(
			admin.page
				.locator("#admin-main")
				.getByText("No pages found", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(admin.page).toHaveScreenshot(
			"admin-pages-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin redirects list", async ({ admin }) => {
		await admin.page.goto("/admin/redirects");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-redirects-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin sitemap settings", async ({ admin }) => {
		await admin.page.goto("/admin/sitemap");
		const main = admin.page.locator("#admin-main");
		await expect(
			main.getByText(
				"No sitemap entries yet. Click Regenerate to build the sitemap from your store data.",
				{ exact: true },
			),
		).toBeVisible({ timeout: 15_000 });
		await expect(main.getByText("Configuration", { exact: true })).toBeVisible({
			timeout: 15_000,
		});
		await expect(main.getByText("Total URLs", { exact: true })).toBeVisible({
			timeout: 15_000,
		});
		await expect(admin.page).toHaveScreenshot(
			"admin-sitemap-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin product feeds list", async ({ admin }) => {
		await admin.page.goto("/admin/product-feeds");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-product-feeds-list.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── Finance (backfill) ──────────────────────────────────────────────────

	test("admin paypal settings", async ({ admin }) => {
		await admin.page.goto("/admin/paypal");
		await expect(
			admin.page.getByText("Supported Events", { exact: true }),
		).toBeVisible();
		await expect(admin.page).toHaveScreenshot(
			"admin-paypal-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin square settings", async ({ admin }) => {
		await admin.page.goto("/admin/square");
		await expect(
			admin.page.getByText("Supported Events", { exact: true }),
		).toBeVisible();
		await expect(admin.page).toHaveScreenshot(
			"admin-square-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin braintree settings", async ({ admin }) => {
		await admin.page.goto("/admin/braintree");
		await expect(
			admin.page.getByText("Supported Events", { exact: true }),
		).toBeVisible();
		await expect(admin.page).toHaveScreenshot(
			"admin-braintree-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin currencies list", async ({ admin }) => {
		await admin.page.goto("/admin/currencies");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-currencies-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin audit log", async ({ admin }) => {
		await admin.page.goto("/admin/audit-log");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-audit-log.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin search settings", async ({ admin }) => {
		await admin.page.goto("/admin/search");
		const synonymRows = admin.page
			.getByRole("button", { name: "Remove", exact: true })
			.locator("..");
		await expect(synonymRows).toHaveCount(6);
		const arrowColumns = await synonymRows
			.getByText("→", { exact: true })
			.evaluateAll((arrows) => [
				...new Set(
					arrows.map((arrow) => Math.round(arrow.getBoundingClientRect().x)),
				),
			]);
		expect(arrowColumns).toHaveLength(1);
		await expect(admin.page).toHaveScreenshot(
			"admin-search-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	// ─── System (backfill) ───────────────────────────────────────────────────

	test("admin import export", async ({ admin }) => {
		await admin.page.goto("/admin/import-export");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-import-export.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin store settings", async ({ admin }) => {
		await admin.page.goto("/admin/settings");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-settings-general.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin store-locator list", async ({ admin }) => {
		await admin.page.goto("/admin/store-locator");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-store-locator-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin affiliates list", async ({ admin }) => {
		await admin.page.goto("/admin/affiliates");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-affiliates-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin amazon settings", async ({ admin }) => {
		await admin.page.goto("/admin/amazon");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-amazon-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin bulk pricing list", async ({ admin }) => {
		await admin.page.goto("/admin/bulk-pricing");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-bulk-pricing-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin digital downloads list", async ({ admin }) => {
		await admin.page.goto("/admin/downloads");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-digital-downloads-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin doordash settings", async ({ admin }) => {
		await admin.page.goto("/admin/doordash");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-doordash-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin ebay settings", async ({ admin }) => {
		await admin.page.goto("/admin/ebay");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-ebay-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin etsy settings", async ({ admin }) => {
		await admin.page.goto("/admin/etsy");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-etsy-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin facebook shop settings", async ({ admin }) => {
		await admin.page.goto("/admin/facebook-shop");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-facebook-shop-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin favor settings", async ({ admin }) => {
		await admin.page.goto("/admin/favor");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-favor-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin gamification overview", async ({ admin }) => {
		await admin.page.goto("/admin/gamification");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-gamification-overview.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin google shopping settings", async ({ admin }) => {
		await admin.page.goto("/admin/google-shopping");
		await admin.page.waitForLoadState("load");
		const main = admin.page.locator("#admin-main");
		await expect(main.getByText("Not Configured", { exact: true })).toBeVisible(
			{
				timeout: 15_000,
			},
		);
		await expect(main.getByText("No feed items", { exact: true })).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			main.getByText("Awaiting review", { exact: true }),
		).toBeVisible({
			timeout: 15_000,
		});
		await expect(admin.page).toHaveScreenshot(
			"admin-google-shopping-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin instagram shop settings", async ({ admin }) => {
		await admin.page.goto("/admin/instagram-shop");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-instagram-shop-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin kiosks list", async ({ admin }) => {
		await admin.page.goto("/admin/kiosk");
		await admin.page.waitForLoadState("load");
		await expect(
			admin.page.getByText("Unavailable", { exact: true }),
		).toHaveCount(2);
		await expect(admin.page).toHaveScreenshot(
			"admin-kiosks-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin kiosk stations", async ({ admin }) => {
		const stationId = "visual-station";
		await admin.page.route("**/api/admin/kiosk/stations*", async (route) => {
			expect(route.request().method()).toBe("GET");
			await route.fulfill({
				json: {
					stations: [
						{
							id: stationId,
							name: "Front Counter",
							location: "Main lobby",
							isActive: true,
							settings: {},
							createdAt: VISUAL_FIXED_TIME.toISOString(),
							updatedAt: VISUAL_FIXED_TIME.toISOString(),
						},
					],
					total: 1,
				},
			});
		});
		await admin.page.route("**/api/admin/kiosk/sessions*", async (route) => {
			expect(route.request().method()).toBe("GET");
			await route.fulfill({
				json: {
					sessions: [
						{
							id: "legacy-session-001",
							stationId,
							status: "legacy-completed",
							startedAt: VISUAL_FIXED_TIME.toISOString(),
							completedAt: VISUAL_FIXED_TIME.toISOString(),
						},
					],
					total: 1,
				},
			});
		});

		await admin.page.goto("/admin/kiosk/stations");
		await admin.page.getByRole("button", { name: "Sessions" }).click();
		await expect(
			admin.page.getByText("legacy completed", { exact: true }),
		).toBeVisible();
		await expect(
			admin.page.getByRole("columnheader", { name: "Payment" }),
		).toHaveCount(0);
		await expect(
			admin.page.getByRole("columnheader", { name: "Item subtotal" }),
		).toHaveCount(0);
		await expect(admin.page).toHaveScreenshot(
			"admin-kiosk-stations.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin notifications list", async ({ admin }) => {
		await admin.page.goto("/admin/notifications");
		const main = admin.page.locator("#admin-main");
		await expect(
			main.getByText("No notifications found", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(
			main.getByText("0 total, 0 unread", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(admin.page).toHaveScreenshot(
			"admin-notifications-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin order notes list", async ({ admin }) => {
		await admin.page.goto("/admin/order-notes");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-order-notes-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin photo booth list", async ({ admin }) => {
		await admin.page.goto("/admin/photo-booth");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-photo-booth-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin pinterest shop settings", async ({ admin }) => {
		await admin.page.goto("/admin/pinterest-shop");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-pinterest-shop-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin qr codes list", async ({ admin }) => {
		await admin.page.goto("/admin/qr-codes");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-qr-codes-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin recently viewed list", async ({ admin }) => {
		await admin.page.goto("/admin/recently-viewed");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-recently-viewed-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin saved addresses list", async ({ admin }) => {
		await admin.page.goto("/admin/saved-addresses");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-saved-addresses-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin tiktok shop settings", async ({ admin }) => {
		await admin.page.goto("/admin/tiktok-shop");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-tiktok-shop-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin tipping settings", async ({ admin }) => {
		await admin.page.goto("/admin/tipping");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-tipping-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin toast settings", async ({ admin }) => {
		await admin.page.goto("/admin/toast");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-toast-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin uber direct settings", async ({ admin }) => {
		await admin.page.goto("/admin/uber-direct");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-uber-direct-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin uber eats settings", async ({ admin }) => {
		await admin.page.goto("/admin/uber-eats");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-uber-eats-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin walmart settings", async ({ admin }) => {
		await admin.page.goto("/admin/walmart");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-walmart-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin wish settings", async ({ admin }) => {
		await admin.page.goto("/admin/wish");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-wish-settings.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin wishlist list", async ({ admin }) => {
		await admin.page.goto("/admin/wishlist");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-wishlist-list.png",
			SCREENSHOT_OPTS,
		);
	});

	test("admin x shop settings", async ({ admin }) => {
		await admin.page.goto("/admin/x-shop");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"admin-x-shop-settings.png",
			SCREENSHOT_OPTS,
		);
	});
});

// ─── Account section (authenticated shopper) ─────────────────────────────────

test.describe("Account — Visual", () => {
	test.beforeEach(async ({ admin }) => {
		// Reuse the seeded admin session for the storefront account section.
		await admin.applyStoredAdminSession();
		beginVisualApiPhase(admin.page);
	});

	test("account home page", async ({ admin }) => {
		await admin.page.goto("/account");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-home.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account orders page", async ({ admin }) => {
		await admin.page.goto("/account/orders");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-orders.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account profile page", async ({ admin }) => {
		await admin.page.goto("/account/profile");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-profile.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account addresses page", async ({ admin }) => {
		await admin.page.goto("/account/addresses");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-addresses.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account wishlist page", async ({ admin }) => {
		await admin.page.goto("/account/wishlist");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-wishlist.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account reviews page", async ({ admin }) => {
		await admin.page.goto("/account/reviews");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-reviews.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account subscriptions page", async ({ admin }) => {
		await admin.page.goto("/account/subscriptions");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-subscriptions.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account loyalty page", async ({ admin }) => {
		await admin.page.goto("/account/loyalty");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-loyalty.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account downloads page", async ({ admin }) => {
		await admin.page.goto("/account/downloads");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-downloads.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account returns page", async ({ admin }) => {
		await admin.page.goto("/account/returns");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-returns.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account orders returns page", async ({ admin }) => {
		await admin.page.goto("/account/orders/returns");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-orders-returns.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account appointments page", async ({ admin }) => {
		await admin.page.goto("/account/appointments");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-appointments.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account preorders page", async ({ admin }) => {
		await admin.page.goto("/account/preorders");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-preorders.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account backorders page", async ({ admin }) => {
		await admin.page.goto("/account/backorders");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-backorders.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account store credits page", async ({ admin }) => {
		await admin.page.goto("/account/store-credits");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-store-credits.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account invoices page", async ({ admin }) => {
		await admin.page.goto("/account/invoices");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-invoices.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account warranties page", async ({ admin }) => {
		await admin.page.goto("/account/warranties");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-warranties.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account payment methods page", async ({ admin }) => {
		await admin.page.goto("/account/payment-methods");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"account-payment-methods.png",
			SCREENSHOT_OPTS,
		);
	});

	test("account transactions page", async ({ admin }) => {
		await admin.page.goto("/account/transactions");
		await expect(
			admin.page.getByText("No transactions found", { exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(
			admin.page.getByText("Failed to load transactions", { exact: true }),
		).toHaveCount(0);
		await expect(
			admin.page.getByText(/^Module "[^"]+" encountered an error$/),
		).toHaveCount(0);
		await expect(admin.page).toHaveScreenshot(
			"account-transactions.png",
			SCREENSHOT_OPTS,
		);
	});

	test("affiliate dashboard page", async ({ admin }) => {
		await admin.page.goto("/affiliate/dashboard");
		await admin.page.waitForLoadState("load");
		await expect(admin.page).toHaveScreenshot(
			"affiliate-dashboard.png",
			SCREENSHOT_OPTS,
		);
	});
});

// ─── Unauthenticated account redirect ────────────────────────────────────────

test.describe("Account — Unauthenticated", () => {
	test("account page redirects to signin", async ({ page }) => {
		await page.goto("/account");
		await page.waitForURL((url) => url.pathname.startsWith("/auth/signin"), {
			timeout: 10_000,
		});
		await page.waitForLoadState("load");
		await expect(page).toHaveScreenshot(
			"account-unauthenticated-redirect.png",
			SCREENSHOT_OPTS,
		);
	});
});
