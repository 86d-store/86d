import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { createAdminQueryRecorder } from "./fixtures/admin-query-recorder";
import { test } from "./fixtures/test-fixtures";

test.describe("Authenticated admin browser smoke", () => {
	test.beforeEach(async ({ admin }) => {
		await admin.applyStoredAdminSession();
	});

	test("analytics sends each selected range exactly once", async ({
		admin,
	}) => {
		const recorder = createAdminQueryRecorder();
		let advancedClockForResponse = false;
		let allowedRequestsPerPath = 1;
		const thirtyDayStats = new URLSearchParams({
			since: "2026-07-26T12:00:00.000Z",
		});
		const thirtyDayProducts = new URLSearchParams({
			limit: "10",
			since: "2026-07-26T12:00:00.000Z",
		});
		const sevenDayStats = new URLSearchParams({
			since: "2026-08-18T14:00:00.000Z",
		});
		const sevenDayProducts = new URLSearchParams({
			limit: "10",
			since: "2026-08-18T14:00:00.000Z",
		});

		await admin.page.clock.setFixedTime(new Date("2026-08-25T12:00:00.000Z"));
		await admin.page.route(
			/\/api\/admin\/analytics\/(stats|top-products)(?:\?|$)/,
			async (route) => {
				const requestUrl = route.request().url();
				recorder.record(requestUrl);
				if (
					recorder.countPath(new URL(requestUrl).pathname) >
					allowedRequestsPerPath
				) {
					await route.abort();
					return;
				}
				if (!advancedClockForResponse) {
					advancedClockForResponse = true;
					await admin.page.clock.setFixedTime(
						new Date("2026-08-25T13:00:00.000Z"),
					);
				}
				await route.fulfill({
					json:
						new URL(requestUrl).pathname === "/api/admin/analytics/stats"
							? { stats: [] }
							: { products: [] },
				});
			},
		);

		await admin.page.goto("/admin/analytics");
		await expect(
			admin.page.getByText("Total Events", { exact: true }),
		).toBeVisible();
		await expect(
			admin.page.getByText("Loading…", { exact: true }),
		).toBeHidden();
		expect(recorder.countPath("/api/admin/analytics/stats")).toBe(1);
		expect(recorder.countPath("/api/admin/analytics/top-products")).toBe(1);
		expect(
			recorder.countExact("/api/admin/analytics/stats", thirtyDayStats),
		).toBe(1);
		expect(
			recorder.countExact(
				"/api/admin/analytics/top-products",
				thirtyDayProducts,
			),
		).toBe(1);

		await admin.page.clock.setFixedTime(new Date("2026-08-25T14:00:00.000Z"));
		allowedRequestsPerPath = 2;
		const nextStatsResponse = admin.page.waitForResponse((response) =>
			response.url().includes("/api/admin/analytics/stats?"),
		);
		const nextProductsResponse = admin.page.waitForResponse((response) =>
			response.url().includes("/api/admin/analytics/top-products?"),
		);
		await admin.page.getByRole("button", { name: "7d", exact: true }).click();
		await Promise.all([nextStatsResponse, nextProductsResponse]);
		await expect(
			admin.page.getByText("Loading…", { exact: true }),
		).toBeHidden();
		expect(recorder.countPath("/api/admin/analytics/stats")).toBe(2);
		expect(recorder.countPath("/api/admin/analytics/top-products")).toBe(2);
		expect(
			recorder.countExact("/api/admin/analytics/stats", sevenDayStats),
		).toBe(1);
		expect(
			recorder.countExact(
				"/api/admin/analytics/top-products",
				sevenDayProducts,
			),
		).toBe(1);
	});

	test("revenue sends each selected range exactly once", async ({ admin }) => {
		const recorder = createAdminQueryRecorder();
		let advancedStatsClockForResponse = false;
		let advancedTransactionsClockForResponse = false;
		let allowedStatsRequests = 1;
		let allowedTransactionRequests = 1;
		const thirtyDayStats = new URLSearchParams({
			from: "2026-07-26T12:00:00.000Z",
			to: "2026-08-25T12:00:00.000Z",
		});
		const sevenDayStats = new URLSearchParams({
			from: "2026-08-18T14:00:00.000Z",
			to: "2026-08-25T14:00:00.000Z",
		});
		const sevenDayTransactions = new URLSearchParams({
			page: "1",
			limit: "20",
			from: "2026-08-18T14:00:00.000Z",
			to: "2026-08-25T14:00:00.000Z",
		});
		const ninetyDayTransactions = new URLSearchParams({
			page: "1",
			limit: "20",
			from: "2026-05-27T16:00:00.000Z",
			to: "2026-08-25T16:00:00.000Z",
		});

		await admin.page.clock.setFixedTime(new Date("2026-08-25T12:00:00.000Z"));
		await admin.page.route(
			/\/api\/admin\/revenue\/(stats|transactions)(?:\?|$)/,
			async (route) => {
				const requestUrl = route.request().url();
				const path = new URL(requestUrl).pathname;
				recorder.record(requestUrl);
				const allowedRequests =
					path === "/api/admin/revenue/stats"
						? allowedStatsRequests
						: allowedTransactionRequests;
				if (recorder.countPath(path) > allowedRequests) {
					await route.abort();
					return;
				}

				if (path === "/api/admin/revenue/stats") {
					if (!advancedStatsClockForResponse) {
						advancedStatsClockForResponse = true;
						await admin.page.clock.setFixedTime(
							new Date("2026-08-25T13:00:00.000Z"),
						);
					}
					await route.fulfill({
						json: {
							totalVolume: 0,
							transactionCount: 0,
							averageValue: 0,
							currency: "USD",
							byStatus: {
								pending: 0,
								processing: 0,
								succeeded: 0,
								failed: 0,
								cancelled: 0,
								refunded: 0,
							},
							refundVolume: 0,
							refundCount: 0,
						},
					});
					return;
				}

				if (!advancedTransactionsClockForResponse) {
					advancedTransactionsClockForResponse = true;
					await admin.page.clock.setFixedTime(
						new Date("2026-08-25T15:00:00.000Z"),
					);
				}
				await route.fulfill({ json: { transactions: [], total: 0 } });
			},
		);

		await admin.page.goto("/admin/revenue");
		await expect(
			admin.page.getByText("Total Revenue", { exact: true }),
		).toBeVisible();
		await expect(admin.page.locator("main .animate-pulse")).toHaveCount(0);
		expect(recorder.countPath("/api/admin/revenue/stats")).toBe(1);
		expect(
			recorder.countExact("/api/admin/revenue/stats", thirtyDayStats),
		).toBe(1);

		await admin.page.clock.setFixedTime(new Date("2026-08-25T14:00:00.000Z"));
		allowedStatsRequests = 2;
		const sevenDayStatsResponse = admin.page.waitForResponse((response) =>
			response.url().includes("/api/admin/revenue/stats?"),
		);
		await admin.page
			.getByRole("button", { name: "Last 7 days", exact: true })
			.click();
		await sevenDayStatsResponse;
		expect(recorder.countPath("/api/admin/revenue/stats")).toBe(2);
		expect(recorder.countExact("/api/admin/revenue/stats", sevenDayStats)).toBe(
			1,
		);

		await admin.page
			.getByRole("button", { name: "transactions", exact: true })
			.click();
		await expect(
			admin.page.getByText("No transactions found", { exact: true }),
		).toBeVisible();
		expect(recorder.countPath("/api/admin/revenue/transactions")).toBe(1);
		expect(
			recorder.countExact(
				"/api/admin/revenue/transactions",
				sevenDayTransactions,
			),
		).toBe(1);

		await admin.page.clock.setFixedTime(new Date("2026-08-25T16:00:00.000Z"));
		allowedTransactionRequests = 2;
		const ninetyDayTransactionsResponse = admin.page.waitForResponse(
			(response) => response.url().includes("/api/admin/revenue/transactions?"),
		);
		await admin.page
			.getByRole("button", { name: "Last 90 days", exact: true })
			.click();
		await ninetyDayTransactionsResponse;
		expect(recorder.countPath("/api/admin/revenue/transactions")).toBe(2);
		expect(
			recorder.countExact(
				"/api/admin/revenue/transactions",
				ninetyDayTransactions,
			),
		).toBe(1);
	});

	test("admin main has no serious semantic Axe violations", async ({
		admin,
	}) => {
		await admin.page.goto("/admin/products");
		await expect(
			admin.page.getByRole("heading", { name: "Products", exact: true }),
		).toBeVisible({ timeout: 15_000 });
		await expect(
			admin.page.getByText("Loading products…", { exact: true }),
		).toBeHidden({ timeout: 15_000 });

		const results = await new AxeBuilder({ page: admin.page })
			.include("main")
			.disableRules(["color-contrast"])
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		const violations = results.violations.filter((violation) =>
			["critical", "serious"].includes(violation.impact ?? ""),
		);
		expect(violations).toHaveLength(0);
	});
});

test.describe("Admin mobile browser seams", () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test("keeps the primary products action reachable without overflow", async ({
		admin,
	}) => {
		await admin.applyStoredAdminSession();
		await admin.page.goto("/admin/products");
		await expect(
			admin.page.getByRole("heading", { name: "Products" }),
		).toBeVisible();
		await expect(
			admin.page.getByRole("link", { name: "New product", exact: true }),
		).toBeInViewport({ ratio: 1 });
		expect(
			await admin.page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
	});

	test("allows horizontal recovery of the products table", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		const response = await page.goto(
			"/__merchant_ui_fixtures__?surface=products",
		);
		expect(response?.ok()).toBe(true);
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
	});
});
