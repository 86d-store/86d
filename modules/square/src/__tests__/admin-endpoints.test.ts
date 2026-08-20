import { describe, expect, it, vi } from "vitest";
import { getSettings } from "../admin/endpoints/get-settings";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true, locationCount: 3 }),
);

vi.mock("../provider", () => ({
	SquarePaymentProvider: class {
		verifyConnection = mockVerifyConnection;
	},
}));

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	options: Record<string, unknown> = {},
) {
	return handler({
		query: {},
		params: {},
		body: {},
		context: { options },
	});
}

const settingsHandler = extractHandler(getSettings);

describe("admin GET /square/settings", () => {
	it("returns not_configured when accessToken is absent", async () => {
		const result = (await call(settingsHandler)) as {
			status: string;
			accessTokenMasked: null;
			webhookSignatureConfigured: boolean;
			webhookNotificationUrl: null;
		};
		expect(result.status).toBe("not_configured");
		expect(result.accessTokenMasked).toBeNull();
		expect(result.webhookSignatureConfigured).toBe(false);
		expect(result.webhookNotificationUrl).toBeNull();
	});

	it("returns connected with location count when verification succeeds", async () => {
		mockVerifyConnection.mockResolvedValue({ ok: true, locationCount: 5 });
		const result = (await call(settingsHandler, {
			accessToken: "EAAAEAbcdefghijk12345",
			webhookSignatureKey: "whk_admin_test",
			webhookNotificationUrl: "https://example.com/webhooks/square",
		})) as { status: string; locationCount: number; accessTokenMasked: string };
		expect(result.status).toBe("connected");
		expect(result.locationCount).toBe(5);
		expect(result.accessTokenMasked).toMatch(/\*+/);
	});

	it("returns error when verification fails", async () => {
		mockVerifyConnection.mockResolvedValue({
			ok: false,
			error: "Unauthorized",
		});
		const result = (await call(settingsHandler, {
			accessToken: "EAAAEAbcdefghijk12345",
			webhookSignatureKey: "whk_admin_test",
			webhookNotificationUrl: "https://example.com/webhooks/square",
		})) as { status: string; error: string };
		expect(result.status).toBe("error");
		expect(result.error).toBe("Unauthorized");
	});

	it("includes webhook fields when configured", async () => {
		mockVerifyConnection.mockResolvedValue({ ok: true, locationCount: 1 });
		const result = (await call(settingsHandler, {
			accessToken: "EAAAEAbcdefghijk12345",
			webhookSignatureKey: "whk_abcdef12345678",
			webhookNotificationUrl: "https://example.com/webhooks/square",
		})) as {
			webhookSignatureConfigured: boolean;
			webhookSignatureKeyMasked: string;
			webhookNotificationUrl: string;
		};
		expect(result.webhookSignatureConfigured).toBe(true);
		expect(result.webhookSignatureKeyMasked).toMatch(/\*+/);
		expect(result.webhookNotificationUrl).toBe(
			"https://example.com/webhooks/square",
		);
	});

	it("does not call provider when accessToken is absent", async () => {
		mockVerifyConnection.mockClear();
		await call(settingsHandler);
		expect(mockVerifyConnection).not.toHaveBeenCalled();
	});
});
