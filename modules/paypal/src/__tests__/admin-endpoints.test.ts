import { describe, expect, it, vi } from "vitest";
import { getSettings } from "../admin/endpoints/get-settings";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true }),
);

vi.mock("../provider", () => ({
	PayPalPaymentProvider: class {
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

describe("admin GET /paypal/settings", () => {
	it("returns not_configured when credentials are absent", async () => {
		const result = (await call(settingsHandler)) as {
			status: string;
			clientIdMasked: null;
			clientSecretMasked: null;
			mode: string;
			webhookIdConfigured: boolean;
		};
		expect(result.status).toBe("not_configured");
		expect(result.clientIdMasked).toBeNull();
		expect(result.clientSecretMasked).toBeNull();
		expect(result.mode).toBe("live");
		expect(result.webhookIdConfigured).toBe(false);
	});

	it("defaults to live mode when sandbox is not set", async () => {
		const result = (await call(settingsHandler)) as { mode: string };
		expect(result.mode).toBe("live");
	});

	it("returns sandbox mode when sandbox=true", async () => {
		mockVerifyConnection.mockResolvedValue({ ok: true });
		const result = (await call(settingsHandler, {
			clientId: "AaBbCcDd12345678",
			clientSecret: "EeFfGgHh12345678",
			sandbox: "true",
		})) as { mode: string };
		expect(result.mode).toBe("sandbox");
	});

	it("returns connected when both credentials provided and verification succeeds", async () => {
		mockVerifyConnection.mockResolvedValue({ ok: true });
		const result = (await call(settingsHandler, {
			clientId: "AaBbCcDd12345678",
			clientSecret: "EeFfGgHh12345678",
			webhookId: "WH-admin-test",
		})) as { status: string; clientIdMasked: string };
		expect(result.status).toBe("connected");
		expect(result.clientIdMasked).toMatch(/\*+/);
	});

	it("returns error when verification fails", async () => {
		mockVerifyConnection.mockResolvedValue({
			ok: false,
			error: "Invalid credentials",
		});
		const result = (await call(settingsHandler, {
			clientId: "AaBbCcDd12345678",
			clientSecret: "EeFfGgHh12345678",
			webhookId: "WH-admin-test",
		})) as { status: string; error: string };
		expect(result.status).toBe("error");
		expect(result.error).toBe("Invalid credentials");
	});

	it("shows webhook configured when webhookId is provided", async () => {
		mockVerifyConnection.mockResolvedValue({ ok: true });
		const result = (await call(settingsHandler, {
			clientId: "AaBbCcDd12345678",
			clientSecret: "EeFfGgHh12345678",
			webhookId: "WH-12345678901234567",
		})) as { webhookIdConfigured: boolean; webhookIdMasked: string };
		expect(result.webhookIdConfigured).toBe(true);
		expect(result.webhookIdMasked).toMatch(/\*+/);
	});

	it("does not call provider when only one credential is set", async () => {
		mockVerifyConnection.mockClear();
		await call(settingsHandler, { clientId: "AaBbCcDd12345678" });
		expect(mockVerifyConnection).not.toHaveBeenCalled();
	});
});
