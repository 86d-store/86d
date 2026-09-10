import { defineConfig, devices } from "@playwright/test";
import { getProcessEnv } from "env/process-env";

const STORE_URL = getProcessEnv("BROWSER_STORE_URL") || "http://localhost:3000";
const htmlReporter: ["html", { outputFolder: string }] = [
	"html",
	{ outputFolder: "../browser-report" },
];

export default defineConfig({
	testDir: "browser",
	testIgnore: "**/__tests__/**",
	outputDir: "../browser-results",
	globalSetup: "./browser/global-setup.ts",
	fullyParallel: false,
	forbidOnly: !!getProcessEnv("CI"),
	retries: 0,
	// The cases share one seeded store, persisted cart state, and auth rate limits.
	workers: 1,
	reporter: getProcessEnv("CI") ? [["github"], htmlReporter] : [htmlReporter],
	timeout: 30_000,
	expect: {
		timeout: 10_000,
	},
	use: {
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "browser-smoke",
			use: {
				...devices["Desktop Chrome"],
				baseURL: STORE_URL,
			},
		},
	],
	...(getProcessEnv("BROWSER_START_SERVER") === "1"
		? {
				webServer: {
					command: "bun run dev:store",
					env: {
						BROWSER_MERCHANT_UI_FIXTURES: "true",
					},
					url: STORE_URL,
					reuseExistingServer: true,
					timeout: 120_000,
				},
			}
		: {}),
});
