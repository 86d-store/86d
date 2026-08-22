import { expect, test } from "@playwright/test";

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
			await page.goto(`/__merchant_ui_fixtures__?state=${state}`, {
				waitUntil: "load",
			});
			await page.evaluate(() => document.fonts.ready);
			await expect(page.getByTestId(`merchant-state-${state}`)).toBeVisible();
			await expect(page).toHaveScreenshot(
				`products-${state}-desktop-light.png`,
				screenshotOpts,
			);
		});
	}

	test("products table fixture @mobile dark", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/__merchant_ui_fixtures__?surface=products", {
			waitUntil: "load",
		});
		await page.evaluate(() => document.fonts.ready);
		await expect(page.getByTestId("products-data-table")).toBeVisible();
		await expect(page).toHaveScreenshot(
			"products-table-mobile-dark.png",
			screenshotOpts,
		);
	});
});
