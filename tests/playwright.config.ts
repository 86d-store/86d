import { defineConfig, devices } from "@playwright/test";
import { getProcessEnv } from "env/process-env";

/**
 * Playwright E2E configuration for 86d commerce platform.
 *
 * Run against locally running apps:
 *   bun run dev:store                    # start the store dev server (port 3000)
 *   PLAYWRIGHT_START_SERVER=1 bun run test:e2e   # auto-start dev server + run tests
 *   bun run test:e2e                     # run tests against already-running server
 *
 * In headless / CI environments do NOT set PLAYWRIGHT_START_SERVER — there is no
 * display and the dev server will hang indefinitely.  Start the server separately
 * (e.g. `bun run build && bun run start`) or point E2E_STORE_URL at a deployed URL.
 *
 * Environment variables:
 *   E2E_STORE_URL            — store URL (default: http://localhost:3000)
 *   E2E_ADMIN_EMAIL          — admin account email for auth tests
 *   E2E_ADMIN_PASSWORD       — admin account password for auth tests
 *   PLAYWRIGHT_START_SERVER  — set to "1" to auto-start the dev server before tests
 */

const STORE_URL = getProcessEnv("E2E_STORE_URL") || "http://localhost:3000";
const htmlReporter: ["html", { outputFolder: string }] = [
	"html",
	{ outputFolder: "../playwright-report" },
];
/* Visual snapshots are Linux CI artifacts. Local Darwin runs differ enough to
 * fail the suite even when the UI is unchanged. Set E2E_VISUAL=1 to include them. */
const runVisual =
	Boolean(getProcessEnv("CI")) || getProcessEnv("E2E_VISUAL") === "1";

export default defineConfig({
	testDir: "e2e",
	outputDir: "../test-results",
	globalSetup: "./e2e/global-setup.ts",
	snapshotPathTemplate:
		"{testDir}/{testFilePath}-snapshots/{arg}{-projectName}{ext}",
	fullyParallel: true,
	forbidOnly: !!getProcessEnv("CI"),
	retries: getProcessEnv("CI") ? 2 : 0,
	/* Parallel workers share one origin and trip in-memory auth/API rate limits. */
	workers: 1,
	reporter: getProcessEnv("CI") ? [["github"], htmlReporter] : [htmlReporter],
	timeout: 30_000,
	expect: {
		timeout: 10_000,
	},
	use: {
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "on-first-retry",
	},
	projects: [
		/* ── Store (storefront + store admin) ─────────────────────────── */
		{
			name: "store-chromium",
			testMatch: [
				"storefront.spec.ts",
				"admin.spec.ts",
				"checkout.spec.ts",
				"dashboard.spec.ts",
				"accessibility.spec.ts",
				"performance.spec.ts",
				"merchant-ui-fixtures.spec.ts",
			],
			use: {
				...devices["Desktop Chrome"],
				baseURL: STORE_URL,
			},
		},
		{
			name: "store-mobile",
			testMatch: ["storefront.spec.ts"],
			use: {
				...devices["Pixel 5"],
				baseURL: STORE_URL,
			},
		},
		...(runVisual
			? [
					{
						name: "visual-desktop",
						testMatch: ["visual.spec.ts"],
						use: {
							...devices["Desktop Chrome"],
							baseURL: STORE_URL,
							viewport: { width: 1280, height: 720 },
						},
					},
					{
						name: "visual-tablet",
						testMatch: ["visual.spec.ts"],
						use: {
							...devices["Desktop Chrome"],
							baseURL: STORE_URL,
							viewport: { width: 768, height: 1024 },
						},
					},
					{
						name: "visual-mobile",
						testMatch: ["visual.spec.ts"],
						use: {
							...devices["Pixel 5"],
							baseURL: STORE_URL,
							viewport: { width: 375, height: 667 },
						},
					},
					{
						name: "visual-dark-desktop",
						testMatch: ["visual.spec.ts"],
						use: {
							...devices["Desktop Chrome"],
							baseURL: STORE_URL,
							viewport: { width: 1280, height: 720 },
							colorScheme: "dark" as const,
						},
					},
					{
						name: "visual-dark-tablet",
						testMatch: ["visual.spec.ts"],
						use: {
							...devices["Desktop Chrome"],
							baseURL: STORE_URL,
							viewport: { width: 768, height: 1024 },
							colorScheme: "dark" as const,
						},
					},
					{
						name: "visual-dark-mobile",
						testMatch: ["visual.spec.ts"],
						use: {
							...devices["Pixel 5"],
							baseURL: STORE_URL,
							viewport: { width: 375, height: 667 },
							colorScheme: "dark" as const,
						},
					},
				]
			: []),
	],
	/* Only auto-start the dev server when explicitly requested.
	 * Never set PLAYWRIGHT_START_SERVER in headless/CI — the dev server
	 * will hang indefinitely with no display and block the entire process. */
	...(getProcessEnv("PLAYWRIGHT_START_SERVER") === "1"
		? {
				webServer: {
					command: "bun run dev:store",
					url: STORE_URL,
					reuseExistingServer: true,
					timeout: 120_000,
				},
			}
		: {}),
});
