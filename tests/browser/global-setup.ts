import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { getProcessEnv } from "env/process-env";
import {
	ADMIN_EMAIL,
	ADMIN_PASSWORD,
	ADMIN_STORAGE_STATE_PATH,
} from "./fixtures/test-fixtures";

/**
 * Sign in once so browser cases reuse one session instead of repeatedly hitting
 * the shared authentication rate limit.
 */
export default async function globalSetup(config: FullConfig) {
	const baseURL =
		getProcessEnv("BROWSER_STORE_URL") ||
		config.projects.find((project) => project.use.baseURL)?.use.baseURL ||
		"http://localhost:3000";

	mkdirSync(dirname(ADMIN_STORAGE_STATE_PATH), { recursive: true });

	const browser = await chromium.launch();
	const context = await browser.newContext({ baseURL });
	try {
		// Authenticate through the browser context so a cold dev server does not race
		// the sign-in form's client-side hydration.
		const signInResponse = await context.request.post(
			"/api/auth/sign-in/email",
			{
				data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
				timeout: 60_000,
			},
		);
		if (!signInResponse.ok()) {
			throw new Error(
				`Admin sign-in failed with HTTP ${signInResponse.status()}.`,
			);
		}
		await context.storageState({ path: ADMIN_STORAGE_STATE_PATH });
	} finally {
		await browser.close();
	}
}
