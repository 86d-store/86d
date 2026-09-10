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

test.describe("Store UI rewrite", () => {
	test.use({ locale: "en-US", timezoneId: "UTC", reducedMotion: "reduce" });

	for (const viewport of [
		{ width: 1280, height: 720, name: "desktop" },
		{ width: 768, height: 1024, name: "tablet" },
		{ width: 375, height: 667, name: "mobile" },
	]) {
		for (const theme of ["light", "dark"] as const) {
			test(`dashboard states ${viewport.name} ${theme}`, async ({
				page,
			}, testInfo) => {
				await page.setViewportSize(viewport);
				await page.emulateMedia({ colorScheme: theme });
				const errors: string[] = [];
				page.on("pageerror", (error) => errors.push(error.message));
				for (const state of [
					"loaded",
					"empty",
					"loading",
					"error",
					"permission",
					"unavailable",
				]) {
					await page.goto(`/__merchant_ui_fixtures__/store-ui?state=${state}`);
					await expect(
						page.getByRole("heading", { name: "Dashboard", exact: true }),
					).toBeVisible();
					await page.evaluate(() => document.fonts.ready);
					await expect
						.poll(() =>
							page.evaluate(
								() => document.documentElement.scrollWidth <= innerWidth,
							),
						)
						.toBe(true);
					await expect(page.locator("html")).toHaveClass(
						theme === "dark" ? /dark/ : /light/,
					);
					const expectedValues = [
						"loading",
						"permission",
						"unavailable",
					].includes(state)
						? 0
						: state === "error"
							? 6
							: 8;
					await expect(page.getByTestId("stat-value")).toHaveCount(
						expectedValues,
					);
					await testInfo.attach(`${state}-${viewport.name}-${theme}`, {
						body: await page.screenshot({
							animations: "disabled",
							style: "nextjs-portal { display: none; }",
						}),
						contentType: "image/png",
					});
				}
				expect(errors).toEqual([]);
			});
		}
	}

	test("mobile menu restores focus and releases theme preload", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
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

	test("account navigation is labeled and recovery action works", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto("/__merchant_ui_fixtures__/store-ui?surface=account");
		await expect(page.getByTestId("account-navigation-select")).toBeVisible();
		await expect(page.getByLabel("Account section")).toHaveAttribute(
			"id",
			"account-navigation",
		);
		await expect
			.poll(() =>
				page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
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
