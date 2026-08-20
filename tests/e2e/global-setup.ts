import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import {
	ADMIN_EMAIL,
	ADMIN_PASSWORD,
	ADMIN_STORAGE_STATE_PATH,
} from "./fixtures/test-fixtures";

/**
 * Sign in once for the suite and persist the session. Admin tests reuse these
 * cookies instead of posting credentials on every case, which trips Better Auth
 * rate limits under parallel workers.
 */
export default async function globalSetup(config: FullConfig) {
	const baseURL =
		process.env.E2E_STORE_URL ||
		config.projects.find((project) => project.use.baseURL)?.use.baseURL ||
		"http://localhost:3000";

	mkdirSync(dirname(ADMIN_STORAGE_STATE_PATH), { recursive: true });

	const browser = await chromium.launch();
	const page = await browser.newPage({ baseURL });
	try {
		await page.goto("/auth/signin?redirect=/admin");
		const form = page.locator("main form");
		await form.locator('input[type="email"]').fill(ADMIN_EMAIL);
		await form.locator('input[type="password"]').fill(ADMIN_PASSWORD);
		await form.locator('button[type="submit"]').click();
		await page.waitForURL((url) => url.pathname.startsWith("/admin"), {
			timeout: 30_000,
		});
		await page.context().storageState({ path: ADMIN_STORAGE_STATE_PATH });
	} finally {
		await browser.close();
	}
}
