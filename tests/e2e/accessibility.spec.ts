import AxeBuilder from "@axe-core/playwright";
import { AdminPage, expect, test } from "./fixtures/test-fixtures";

/**
 * Accessibility tests using axe-core.
 *
 * Runs WCAG 2.1 AA checks on every key storefront page.
 * Any critical/serious violation fails the test.
 */

test.describe("Storefront — Accessibility (axe-core)", () => {
	test("homepage passes axe", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("header")).toBeVisible({ timeout: 10_000 });

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Homepage axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});

	test("products page passes axe", async ({ page }) => {
		await page.goto("/products");
		await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Products page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});

	test("about page passes axe", async ({ page }) => {
		await page.goto("/about");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`About page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});

	test("contact page passes axe", async ({ page }) => {
		await page.goto("/contact");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Contact page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});

	test("sign-in page passes axe", async ({ page }) => {
		await page.goto("/auth/signin");
		await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 });

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Sign-in page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});

	test("checkout page passes axe (empty cart state)", async ({ page }) => {
		await page.goto("/checkout");
		await page.waitForLoadState("networkidle");

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Checkout page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});

	test("product detail page passes axe", async ({ page }) => {
		await page.goto("/products/regent-penny-loafer");
		await page.waitForLoadState("networkidle");

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Product detail page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});

	test("cart page passes axe", async ({ page }) => {
		await page.goto("/cart");
		await page.waitForLoadState("networkidle");

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Cart page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});

	test("blog post page passes axe", async ({ page }) => {
		await page.goto("/blog/inside-the-atelier");
		await page.waitForLoadState("networkidle");

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Blog post page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});
});

test.describe("Storefront — Accessibility (structural)", () => {
	test("homepage has main landmark", async ({ page }) => {
		await page.goto("/");
		const main = page.locator("main");
		await expect(main).toBeVisible({ timeout: 10_000 });
	});

	test("homepage has accessible header with nav", async ({ page }) => {
		await page.goto("/");
		const header = page.locator("header").first();
		await expect(header).toBeVisible({ timeout: 10_000 });
		await expect(header.locator("nav").first()).toBeVisible();
	});

	test("cart button has accessible label", async ({ page }) => {
		await page.goto("/");
		const cartButton = page.locator('button[aria-label*="Cart"]');
		await expect(cartButton).toBeVisible({ timeout: 10_000 });
	});

	test("product listing has h1 heading", async ({ page }) => {
		await page.goto("/products");
		const h1 = page.locator("h1").first();
		await expect(h1).toBeVisible({ timeout: 15_000 });
	});

	test("product cards are keyboard focusable", async ({ page }) => {
		await page.goto("/products");
		await expect(page.locator("a.group").first()).toBeVisible({
			timeout: 15_000,
		});
		const firstCard = page.locator("a.group").first();
		await firstCard.focus();
		await expect(firstCard).toBeFocused();
	});
});

test.describe("Storefront — Forms", () => {
	test("contact form has associated labels", async ({ page }) => {
		await page.goto("/contact");
		/* Scope to the contact form to avoid newsletter footer email */
		const form = page.locator("form").first();
		const emailInput = form.locator('input[type="email"]');
		await expect(emailInput).toBeVisible({ timeout: 10_000 });
		/* label can be for="contact-email" or wrapping the input */
		const label = page.locator(
			'label[for="contact-email"], label:has(input[type="email"])',
		);
		await expect(label.first()).toBeVisible();
	});
});

// ── Admin — Accessibility ─────────────────────────────────────────────────────
//
// Admin pages use dynamic MDX rendering. Sign in before each test so the
// admin session is established and the full admin UI renders.

async function signInAsAdmin(page: import("@playwright/test").Page) {
	await new AdminPage(page).signIn();
}

test.describe("Admin — Accessibility (axe-core)", () => {
	test.beforeEach(async ({ page }) => {
		await signInAsAdmin(page);
	});

	test("admin dashboard passes axe", async ({ page }) => {
		await page.waitForLoadState("networkidle");

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Admin dashboard axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});

	test("admin products page passes axe", async ({ page }) => {
		await page.goto("/admin/products");
		await page.waitForLoadState("networkidle");
		await page.locator("table, h1, h2").waitFor({ timeout: 15_000 });

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Admin products page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});

	test("admin orders page passes axe", async ({ page }) => {
		await page.goto("/admin/orders");
		await page.waitForLoadState("networkidle");
		await page.locator("table, h1, h2").waitFor({ timeout: 15_000 });

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Admin orders page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});

	test("admin customers page passes axe", async ({ page }) => {
		await page.goto("/admin/customers");
		await page.waitForLoadState("networkidle");
		await page.locator("table, h1, h2").waitFor({ timeout: 15_000 });

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Admin customers page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});
});

test.describe("Admin — Accessibility (axe-core, unauthenticated)", () => {
	test("admin sign-in page passes axe", async ({ page }) => {
		await page.goto("/auth/signin");
		await page.waitForLoadState("networkidle");

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const criticalOrSerious = results.violations.filter((v) =>
			["critical", "serious"].includes(v.impact ?? ""),
		);
		expect(
			criticalOrSerious,
			`Admin sign-in page axe violations:\n${criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    ${v.nodes[0]?.target}`).join("\n")}`,
		).toHaveLength(0);
	});
});

// ── Admin — Structural Accessibility ─────────────────────────────────────────

test.describe("Admin — Accessibility (structural)", () => {
	test.beforeEach(async ({ page }) => {
		await signInAsAdmin(page);
	});

	test("admin dashboard has main landmark", async ({ page }) => {
		const main = page.locator("main");
		await expect(main).toBeVisible({ timeout: 10_000 });
	});

	test("admin sidebar navigation is accessible", async ({ page }) => {
		const nav = page.locator("nav").first();
		await expect(nav).toBeVisible({ timeout: 10_000 });
	});

	test("admin dashboard heading is present", async ({ page }) => {
		const heading = page.locator("h1, h2").first();
		await expect(heading).toBeVisible({ timeout: 10_000 });
	});
});
