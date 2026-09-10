import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { test } from "./fixtures/test-fixtures";

test.describe("Storefront browser seams", () => {
	test("homepage main has no serious semantic Axe violations", async ({
		page,
	}) => {
		await page.goto("/");
		await expect(page.locator("main")).toBeVisible();

		const results = await new AxeBuilder({ page })
			.include("main")
			.disableRules(["color-contrast"])
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		const violations = results.violations.filter((violation) =>
			["critical", "serious"].includes(violation.impact ?? ""),
		);
		expect(violations).toHaveLength(0);
	});

	test("a product card accepts keyboard focus", async ({ storefront }) => {
		await storefront.navigateToProducts();
		const productCard = storefront.allProductCards.first();
		await expect(productCard).toBeVisible({ timeout: 15_000 });
		await productCard.focus();
		await expect(productCard).toBeFocused();
	});
});

test.describe("Storefront mobile menu", () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test("restores focus, releases theme preload, and closes on resize", async ({
		page,
	}) => {
		await page.goto("/__merchant_ui_fixtures__/store-ui?surface=navbar");
		const trigger = page.getByRole("button", {
			name: "Open menu",
			exact: true,
		});
		await expect(
			page.getByRole("navigation", { name: "Mobile navigation" }),
		).toHaveCount(0);
		await trigger.click();
		await expect(
			page.getByRole("button", { name: "Close menu", exact: true }),
		).toBeFocused();
		await page
			.getByRole("button", { name: "Switch to dark mode", exact: true })
			.click();
		await expect(page.locator("html")).toHaveClass(/dark/);
		await expect(page.locator("html")).not.toHaveAttribute(
			"data-theme-preload",
		);
		await page.keyboard.press("Escape");
		await expect(trigger).toBeFocused();
		await expect(
			page.getByRole("navigation", { name: "Mobile navigation" }),
		).toHaveCount(0);
		await trigger.click();
		await page.setViewportSize({ width: 1280, height: 720 });
		await expect(
			page.getByRole("navigation", { name: "Mobile navigation" }),
		).toHaveCount(0);
	});

	test("labels account navigation and recovers a failed page", async ({
		page,
	}) => {
		await page.goto("/__merchant_ui_fixtures__/store-ui?surface=account");
		await expect(page.getByTestId("account-navigation-select")).toBeVisible();
		await expect(page.getByLabel("Account section")).toHaveAttribute(
			"id",
			"account-navigation",
		);
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
			)
			.toBe(true);
		await page.goto("/__merchant_ui_fixtures__/store-ui?surface=recovery");
		await page
			.getByTestId("page-state")
			.getByRole("button", { name: "Try again" })
			.click();
		await expect(
			page.getByText("The page is ready to load again."),
		).toBeVisible();
	});
});
