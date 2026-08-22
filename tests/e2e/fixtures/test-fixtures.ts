import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test as base, type Cookie, expect, type Page } from "@playwright/test";
import { getProcessEnv } from "env/process-env";
/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const ADMIN_EMAIL = getProcessEnv("E2E_ADMIN_EMAIL") || "admin@86d.app";
export const ADMIN_PASSWORD =
	getProcessEnv("E2E_ADMIN_PASSWORD") || "password123";
export const ADMIN_STORAGE_STATE_PATH = resolve(
	process.cwd(),
	"test-results/e2e-admin-storage.json",
);

/* ------------------------------------------------------------------ */
/* Page-object helpers                                                 */
/* ------------------------------------------------------------------ */

export class StorefrontPage {
	constructor(readonly page: Page) {}

	/* Navigation */
	async goto(path = "/") {
		await this.page.goto(path);
	}

	get navbar() {
		return this.page.locator("header").first();
	}

	get cartButton() {
		return this.page.locator('button[aria-label*="Cart"]');
	}

	get cartDrawer() {
		return this.page.locator('[role="dialog"][aria-label="Shopping cart"]');
	}

	get cartItems() {
		return this.cartDrawer.locator("ul > li");
	}

	get cartCloseButton() {
		return this.cartDrawer.locator('[data-slot="sheet-close"]');
	}

	get checkoutLink() {
		return this.cartDrawer.locator('a[href="/checkout"]');
	}

	get heroHeading() {
		return this.page.locator("h1").first();
	}

	get productGrid() {
		return this.page.locator("a.group").first();
	}

	get allProductCards() {
		return this.page.locator("a.group");
	}

	get searchInput() {
		return this.page.locator('input[type="search"]');
	}

	/* Actions */
	async openCart() {
		await this.cartButton.click();
		await expect(this.cartDrawer).toBeVisible();
	}

	async closeCart() {
		await this.cartCloseButton.click();
	}

	async navigateToProducts() {
		await this.page.goto("/products");
	}

	async navigateToProduct(slug: string) {
		await this.page.goto(`/products/${slug}`);
	}

	async searchProducts(query: string) {
		await this.searchInput.fill(query);
		/* Wait for search results to update after debounce */
		await this.page.waitForLoadState("load");
	}

	async addToCartFromDetail(_quantity = 1) {
		const addButton = this.page
			.locator("button")
			.filter({ hasText: "Add to cart" });
		await addButton.click();
		/* Wait for cart mutation to settle */
		await this.page.waitForLoadState("load");
	}
}

export class AdminPage {
	constructor(readonly page: Page) {}

	async goto(path = "/admin") {
		await this.page.goto(path);
	}

	async signIn(email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
		if (
			email === ADMIN_EMAIL &&
			password === ADMIN_PASSWORD &&
			(await this.applyStoredAdminSession())
		) {
			await this.page.goto("/admin");
			await this.page.waitForURL((url) => url.pathname.startsWith("/admin"), {
				timeout: 15_000,
			});
			return;
		}
		await this.signInWithForm(email, password);
	}

	async signInWithForm(email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
		await this.page.goto("/auth/signin?redirect=/admin");
		/* Fill the sign-in form — scope to main to avoid newsletter footer form */
		const form = this.page.locator("main form");
		await form.locator('input[type="email"]').fill(email);
		await form.locator('input[type="password"]').fill(password);
		await form.locator('button[type="submit"]').click();
		/* Wait for redirect to admin — use pathname check to avoid matching
		   the query string in /auth/signin?redirect=/admin */
		await this.page.waitForURL((url) => url.pathname.startsWith("/admin"), {
			timeout: 15_000,
		});
	}

	private async applyStoredAdminSession(): Promise<boolean> {
		if (!existsSync(ADMIN_STORAGE_STATE_PATH)) return false;
		const state = JSON.parse(
			readFileSync(ADMIN_STORAGE_STATE_PATH, "utf8"),
		) as { cookies?: Cookie[] };
		if (!state.cookies?.length) return false;
		await this.page.context().addCookies(state.cookies);
		return true;
	}

	get heading() {
		return this.page.locator("h1").first();
	}

	get statCards() {
		return this.page.locator("[data-testid='stat-card']");
	}

	get sidebar() {
		return this.page.locator("nav").first();
	}

	get sidebarLinks() {
		return this.page.locator("aside a, nav a");
	}

	async navigateTo(sectionName: string) {
		await this.page
			.locator("aside a, nav a")
			.filter({ hasText: sectionName })
			.first()
			.click();
	}

	get accessDeniedHeading() {
		return this.page.locator("h1").filter({ hasText: "Access denied" });
	}

	get forbiddenCode() {
		return this.page.locator("p").filter({ hasText: "403" });
	}
}

/* ------------------------------------------------------------------ */
/* Dashboard page-object                                               */
/* ------------------------------------------------------------------ */

export class DashboardPage {
	constructor(readonly page: Page) {}

	async goto(path = "/") {
		await this.page.goto(path);
	}

	async signUp(name: string, email: string, password: string) {
		await this.page.goto("/auth/signup");
		const form = this.page.locator("main form");
		await form.locator('input[name="name"]').fill(name);
		await form.locator('input[type="email"]').fill(email);
		await form.locator('input[type="password"]').fill(password);
		await form.locator('button[type="submit"]').click();
	}

	async signIn(email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
		await this.page.goto("/auth/signin");
		const form = this.page.locator("main form");
		await form.locator('input[type="email"]').fill(email);
		await form.locator('input[type="password"]').fill(password);
		await form.locator('button[type="submit"]').click();
		/* Wait for redirect to dashboard home */
		await this.page.waitForURL(/\/(stores|$)/, { timeout: 15_000 });
	}

	get heading() {
		return this.page.locator("h1").first();
	}

	get storeCards() {
		return this.page.locator("[data-testid='store-card'], a[href*='/stores/']");
	}

	get sidebarLinks() {
		return this.page.locator("aside a, nav a");
	}

	async navigateTo(path: string) {
		await this.page.goto(path);
	}

	async navigateToFirstStore() {
		const storeLink = this.page.locator("a[href*='/stores/']").first();
		await storeLink.click();
		await this.page.waitForURL(/\/stores\//);
	}
}

/* ------------------------------------------------------------------ */
/* Extended test fixture                                               */
/* ------------------------------------------------------------------ */

type Fixtures = {
	storefront: StorefrontPage;
	admin: AdminPage;
	dashboard: DashboardPage;
};

export const test = base.extend<Fixtures>({
	storefront: async ({ page }, use) => {
		await use(new StorefrontPage(page));
	},
	admin: async ({ page }, use) => {
		await use(new AdminPage(page));
	},
	dashboard: async ({ page }, use) => {
		await use(new DashboardPage(page));
	},
});
