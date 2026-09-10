import type { Cookie, Page } from "@playwright/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => ({
	...(await importOriginal<typeof import("node:fs")>()),
	existsSync: fsMocks.existsSync,
	readFileSync: fsMocks.readFileSync,
}));

import { ADMIN_STORAGE_STATE_PATH, AdminPage } from "../fixtures/test-fixtures";

function adminPageWithCookieSink(
	addCookies: (cookies: Cookie[]) => Promise<void>,
) {
	return new AdminPage({
		context: () => ({ addCookies }),
	} as unknown as Page);
}

describe("AdminPage stored session", () => {
	beforeEach(() => {
		fsMocks.existsSync.mockReset();
		fsMocks.readFileSync.mockReset();
	});

	it("fails closed when the stored admin session is unavailable", async () => {
		fsMocks.existsSync.mockReturnValue(false);
		const addCookies = vi.fn(async (_cookies: Cookie[]) => undefined);
		const admin = adminPageWithCookieSink(addCookies);

		await expect(admin.applyStoredAdminSession()).rejects.toThrow(
			`Stored admin session is unavailable at ${ADMIN_STORAGE_STATE_PATH}`,
		);
		expect(addCookies).not.toHaveBeenCalled();
	});

	it("applies stored cookies without navigating", async () => {
		const cookies: Cookie[] = [
			{
				name: "session",
				value: "signed-session",
				domain: "store.example",
				path: "/",
				expires: -1,
				httpOnly: true,
				secure: true,
				sameSite: "Lax",
			},
		];
		fsMocks.existsSync.mockReturnValue(true);
		fsMocks.readFileSync.mockReturnValue(JSON.stringify({ cookies }));
		const addCookies = vi.fn(async (_cookies: Cookie[]) => undefined);
		const admin = adminPageWithCookieSink(addCookies);

		await admin.applyStoredAdminSession();

		expect(fsMocks.readFileSync).toHaveBeenCalledWith(
			ADMIN_STORAGE_STATE_PATH,
			"utf8",
		);
		expect(addCookies).toHaveBeenCalledOnce();
		expect(addCookies).toHaveBeenCalledWith(cookies);
	});
});
