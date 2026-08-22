import { expect, test } from "@playwright/test";

/**
 * Performance tests — Core Web Vitals and load metrics.
 * These tests assert that key pages load within acceptable time.
 */

test.describe("Storefront — Performance", () => {
	test("homepage loads within 5s", async ({ page }) => {
		const start = Date.now();
		await page.goto("/");
		await expect(page.locator("header")).toBeVisible({ timeout: 10_000 });
		const loadTime = Date.now() - start;
		expect(loadTime).toBeLessThan(5000);
	});

	test("homepage has navigation timing", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("header")).toBeVisible({ timeout: 10_000 });

		const perf = await page.evaluate(() => {
			const entries = performance.getEntriesByType("navigation");
			const nav = entries[0] as PerformanceNavigationTiming | undefined;
			if (!nav) return null;
			return {
				domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
				loadComplete: nav.loadEventEnd - nav.startTime,
			};
		});

		expect(perf).not.toBeNull();
		if (!perf) {
			throw new Error("expected perf");
		}
		expect(perf.domContentLoaded).toBeLessThan(3000);
	});

	test("product listing loads within 8s", async ({ page }) => {
		const start = Date.now();
		await page.goto("/products");
		await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
		await expect(page.locator("a.group").first()).toBeVisible({
			timeout: 15_000,
		});
		const loadTime = Date.now() - start;
		expect(loadTime).toBeLessThan(8000);
	});

	test("product detail page loads within 8s", async ({ page }) => {
		const start = Date.now();
		await page.goto("/products/regent-penny-loafer");
		await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
		const loadTime = Date.now() - start;
		expect(loadTime).toBeLessThan(8000);
	});

	test("cart page loads within 5s", async ({ page }) => {
		const start = Date.now();
		await page.goto("/cart");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		const loadTime = Date.now() - start;
		expect(loadTime).toBeLessThan(5000);
	});

	test("checkout page loads within 6s", async ({ page }) => {
		const start = Date.now();
		await page.goto("/checkout");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		const loadTime = Date.now() - start;
		expect(loadTime).toBeLessThan(6000);
	});

	test("search page loads within 5s", async ({ page }) => {
		const start = Date.now();
		await page.goto("/search");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		const loadTime = Date.now() - start;
		expect(loadTime).toBeLessThan(5000);
	});

	test("blog listing page loads within 6s", async ({ page }) => {
		const start = Date.now();
		await page.goto("/blog");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		const loadTime = Date.now() - start;
		expect(loadTime).toBeLessThan(6000);
	});

	test("collections page loads within 5s", async ({ page }) => {
		const start = Date.now();
		await page.goto("/collections");
		await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
		const loadTime = Date.now() - start;
		expect(loadTime).toBeLessThan(5000);
	});

	test("product listing has navigation timing under 3s DOMContentLoaded", async ({
		page,
	}) => {
		await page.goto("/products");
		await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });

		const perf = await page.evaluate(() => {
			const entries = performance.getEntriesByType("navigation");
			const nav = entries[0] as PerformanceNavigationTiming | undefined;
			if (!nav) return null;
			return { domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime };
		});

		expect(perf).not.toBeNull();
		if (!perf) {
			throw new Error("expected perf");
		}
		expect(perf.domContentLoaded).toBeLessThan(3000);
	});
});
