import { expect } from "@playwright/test";
import { test } from "./fixtures/test-fixtures";

test.describe("Authentication browser smoke", () => {
	test("redirects an unauthenticated admin visit to sign-in", async ({
		page,
	}) => {
		await page.goto("/admin");
		await page.waitForURL((url) => url.pathname === "/auth/signin");
		await expect(page).toHaveURL(/\/auth\/signin$/);
	});

	test("reuses the successful admin session", async ({ admin }) => {
		await admin.applyStoredAdminSession();
		await admin.goto();
		await expect(admin.heading).toHaveText("Dashboard");
		await expect(admin.statCards.first()).toBeVisible();
	});
});
