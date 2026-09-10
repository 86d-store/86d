import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	test as base,
	type ConsoleMessage,
	type Cookie,
	expect,
	type Page,
} from "@playwright/test";
import { getProcessEnv } from "env/process-env";
/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const ADMIN_EMAIL =
	getProcessEnv("BROWSER_ADMIN_EMAIL") ||
	getProcessEnv("APP_ADMIN_EMAIL") ||
	"admin@86d.app";
export const ADMIN_PASSWORD =
	getProcessEnv("BROWSER_ADMIN_PASSWORD") ||
	getProcessEnv("APP_ADMIN_PASSWORD") ||
	"password123";
export const ADMIN_STORAGE_STATE_PATH = resolve(
	process.cwd(),
	".browser-auth/admin-storage-state.json",
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

	get checkoutLink() {
		return this.cartDrawer.locator('a[href="/checkout"]');
	}

	get allProductCards() {
		return this.page.locator('main a.group[href^="/products/"]');
	}

	get addToCartButton() {
		return this.page
			.locator("main")
			.getByRole("button", { name: "Add to cart", exact: true });
	}

	/* Actions */
	async openCart() {
		await this.cartButton.click();
		await expect(this.cartDrawer).toBeVisible();
	}

	async navigateToProducts() {
		await this.page.goto("/products");
	}

	async navigateToFirstInStockProduct() {
		await this.navigateToProducts();
		await expect(this.allProductCards.first()).toBeVisible({ timeout: 15_000 });
		const productCard = this.allProductCards
			.filter({ hasNotText: "Sold out" })
			.first();
		await expect(productCard).toBeVisible({ timeout: 15_000 });
		await productCard.click();
		await this.page.waitForURL(/\/products\/.+/);
		await expect(this.addToCartButton).toBeVisible({ timeout: 15_000 });
	}

	async addFirstInStockProductToCart() {
		await this.navigateToFirstInStockProduct();
		const cartResponsePromise = this.page.waitForResponse(
			(response) =>
				response.url().includes("/api/cart") &&
				response.request().method() === "POST",
			{ timeout: 10_000 },
		);
		await this.addToCartButton.click();
		const cartResponse = await cartResponsePromise;
		expect(
			cartResponse.status(),
			`Cart POST returned ${cartResponse.status()}: ${await cartResponse.text()}`,
		).toBe(200);
		await expect(this.cartDrawer).toBeVisible({ timeout: 5_000 });
		await expect(this.cartItems.first()).toBeVisible({ timeout: 15_000 });
	}
}

export class AdminPage {
	constructor(readonly page: Page) {}

	async goto(path = "/admin") {
		await this.page.goto(path);
	}

	async applyStoredAdminSession() {
		if (await this.tryApplyStoredAdminSession()) return;
		throw new Error(
			`Stored admin session is unavailable at ${ADMIN_STORAGE_STATE_PATH}. Run browser global setup first.`,
		);
	}

	private async tryApplyStoredAdminSession(): Promise<boolean> {
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
}

type Fixtures = {
	storefront: StorefrontPage;
	admin: AdminPage;
	browserRuntimeErrors: undefined;
};

export const test = base.extend<Fixtures>({
	browserRuntimeErrors: [
		async ({ page }, use) => {
			const errors: string[] = [];
			const onConsole = (message: ConsoleMessage) => {
				if (message.type() !== "error") return;
				errors.push(`console.error: ${message.text()}`);
			};
			const onPageError = (error: Error) => {
				errors.push(`pageerror: ${error.message}`);
			};

			page.on("console", onConsole);
			page.on("pageerror", onPageError);
			await use();
			page.off("console", onConsole);
			page.off("pageerror", onPageError);

			expect(errors, "Unexpected browser runtime errors").toEqual([]);
		},
		{ auto: true },
	],
	storefront: async ({ page }, use) => {
		await use(new StorefrontPage(page));
	},
	admin: async ({ page }, use) => {
		await use(new AdminPage(page));
	},
});
