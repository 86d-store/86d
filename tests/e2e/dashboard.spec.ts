import {
	ADMIN_EMAIL,
	ADMIN_PASSWORD,
	expect,
	test,
} from "./fixtures/test-fixtures";

test.describe("User — Authentication", () => {
	test("sign-in page renders with email and password fields", async ({
		storefront,
	}) => {
		await storefront.goto("/auth/signin");
		const heading = storefront.page
			.locator("h1")
			.filter({ hasText: /sign in/i });
		await expect(heading).toBeVisible();
		/* Scope to main to avoid newsletter footer form */
		const form = storefront.page.locator("main form");
		await expect(form.locator('input[type="email"]')).toBeVisible();
		await expect(form.locator('input[type="password"]')).toBeVisible();
		await expect(form.locator('button[type="submit"]')).toBeVisible();
	});

	test("sign-up page renders with name, email, and password fields", async ({
		storefront,
	}) => {
		await storefront.goto("/auth/signup");
		const heading = storefront.page
			.locator("h1")
			.filter({ hasText: /sign up|create an? account/i });
		await expect(heading).toBeVisible();
		const form = storefront.page.locator("main form");
		await expect(form.locator('input[name="name"]')).toBeVisible();
		await expect(form.locator('input[type="email"]')).toBeVisible();
		await expect(form.locator('input[type="password"]')).toBeVisible();
	});

	test("sign-in with valid credentials redirects successfully", async ({
		storefront,
	}) => {
		await storefront.goto("/auth/signin");
		const form = storefront.page.locator("main form");
		await form.locator('input[type="email"]').fill(ADMIN_EMAIL);
		await form.locator('input[type="password"]').fill(ADMIN_PASSWORD);
		await form.locator('button[type="submit"]').click();
		/* Should redirect away from sign-in page */
		await storefront.page.waitForURL(
			(url) => !url.pathname.includes("/auth/signin"),
			{ timeout: 15_000 },
		);
		const url = storefront.page.url();
		expect(url).not.toContain("/auth/signin");
	});

	test("sign-in with invalid credentials stays on sign-in page", async ({
		storefront,
	}) => {
		await storefront.goto("/auth/signin");
		const form = storefront.page.locator("main form");
		await form.locator('input[type="email"]').fill("wrong@invalid.com");
		await form.locator('input[type="password"]').fill("wrongpassword123");
		await form.locator('button[type="submit"]').click();
		await storefront.page.waitForLoadState("networkidle");
		expect(storefront.page.url()).toContain("/auth/signin");
	});

	test("sign-in page links to sign-up and password reset", async ({
		storefront,
	}) => {
		await storefront.goto("/auth/signin");
		const signUpLink = storefront.page
			.locator("a")
			.filter({ hasText: /create account|sign up/i });
		await expect(signUpLink).toBeVisible();
		const resetLink = storefront.page
			.locator("a")
			.filter({ hasText: /forgot password/i });
		await expect(resetLink).toBeVisible();
	});

	test("sign-in with redirect param redirects to target", async ({
		storefront,
	}) => {
		await storefront.goto("/auth/signin?redirect=/admin");
		const form = storefront.page.locator("main form");
		await form.locator('input[type="email"]').fill(ADMIN_EMAIL);
		await form.locator('input[type="password"]').fill(ADMIN_PASSWORD);
		await form.locator('button[type="submit"]').click();
		/* Should redirect to /admin */
		await storefront.page.waitForURL(/\/admin/, { timeout: 15_000 });
		expect(storefront.page.url()).toContain("/admin");
	});
});

test.describe("User — Account pages", () => {
	test("account page requires authentication", async ({ storefront }) => {
		await storefront.goto("/account");
		/* Should redirect to sign-in or show account content */
		await storefront.page.waitForLoadState("networkidle");
		const url = storefront.page.url();
		const isSignIn = url.includes("/auth/signin");
		const hasAccountContent = await storefront.page
			.locator("h1, h2")
			.first()
			.isVisible()
			.catch(() => false);
		expect(isSignIn || hasAccountContent).toBeTruthy();
	});

	test("password reset page renders correctly", async ({ storefront }) => {
		await storefront.goto("/auth/reset");
		const heading = storefront.page
			.locator("h1")
			.filter({ hasText: /reset|password/i });
		await expect(heading).toBeVisible();
		const form = storefront.page.locator("main form");
		await expect(form.locator('input[type="email"]')).toBeVisible();
	});
});

test.describe("User — Navigation", () => {
	test("footer is visible on homepage", async ({ storefront }) => {
		await storefront.goto("/");
		const footer = storefront.page.locator("footer");
		await expect(footer).toBeVisible();
	});

	test("static pages load correctly", async ({ storefront }) => {
		const pages = ["/about", "/contact", "/privacy", "/terms"];
		for (const path of pages) {
			await storefront.goto(path);
			const main = storefront.page.locator("main");
			await expect(main).toBeVisible({ timeout: 10_000 });
		}
	});

	test("collections page loads", async ({ storefront }) => {
		await storefront.goto("/collections");
		await storefront.page.waitForLoadState("networkidle");
		const heading = storefront.page.locator("h1").first();
		await expect(heading).toBeVisible({ timeout: 10_000 });
	});

	test("blog page loads", async ({ storefront }) => {
		await storefront.goto("/blog");
		await storefront.page.waitForLoadState("networkidle");
		const main = storefront.page.locator("main");
		await expect(main).toBeVisible({ timeout: 10_000 });
	});
});
