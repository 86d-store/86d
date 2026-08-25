import { expect } from "@playwright/test";
import { test } from "./fixtures/test-fixtures";

const screenshotOpts = {
	threshold: 0.15,
	maxDiffPixelRatio: 0.005,
	animations: "disabled" as const,
};

test.describe("merchant UI fixtures", () => {
	test.use({
		locale: "en-US",
		timezoneId: "UTC",
	});

	for (const state of [
		"empty",
		"loading",
		"error",
		"permission",
		"provider",
	] as const) {
		test(`products ${state} @desktop`, async ({ page }) => {
			await page.setViewportSize({ width: 1280, height: 720 });
			const response = await page.goto(
				`/__merchant_ui_fixtures__?state=${state}`,
				{
					waitUntil: "load",
				},
			);
			expect(response?.ok()).toBe(true);
			await page.evaluate(() => document.fonts.ready);
			await expect(page.getByTestId(`merchant-state-${state}`)).toBeVisible();
			await expect(page).toHaveScreenshot(
				`products-${state}-desktop-light.png`,
				screenshotOpts,
			);
		});
	}

	test("products header actions remain reachable @mobile", async ({
		page,
		admin,
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await admin.applyStoredAdminSession();
		await page.goto("/admin/products");
		await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
		await expect(
			page.getByRole("link", { name: "New product", exact: true }),
		).toBeInViewport({ ratio: 1 });
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
			)
			.toBe(true);
	});

	test("products table fixture @mobile dark", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.emulateMedia({ colorScheme: "dark" });
		const response = await page.goto(
			"/__merchant_ui_fixtures__?surface=products",
			{
				waitUntil: "load",
			},
		);
		expect(response?.ok()).toBe(true);
		await page.evaluate(() => document.fonts.ready);
		const productTable = page.getByTestId("products-data-table");
		await expect(productTable).toBeVisible();
		const horizontalScroller = productTable.locator(".overflow-x-auto");
		expect(
			await horizontalScroller.evaluate(
				(element) => element.scrollWidth > element.clientWidth,
			),
		).toBe(true);
		await horizontalScroller.evaluate((element) => {
			element.scrollLeft = element.scrollWidth;
		});
		await expect
			.poll(() => horizontalScroller.evaluate((element) => element.scrollLeft))
			.toBeGreaterThan(0);
		await expect(
			productTable.getByRole("columnheader", { name: "SKU" }),
		).toBeInViewport();
		await expect(
			productTable.getByRole("columnheader", { name: "Actions" }),
		).toBeVisible();
		await horizontalScroller.evaluate((element) => {
			element.scrollLeft = 0;
		});
		await expect(page).toHaveScreenshot(
			"products-table-mobile-dark.png",
			screenshotOpts,
		);
	});
});
