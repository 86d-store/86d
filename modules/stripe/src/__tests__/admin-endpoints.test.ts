import { describe, expect, it, vi } from "vitest";
import { getSettings } from "../admin/endpoints/get-settings";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true, accountName: "Test Store" }),
);

vi.mock("../provider", () => ({
	StripePaymentProvider: class {
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

describe("admin GET /stripe/settings", () => {
	it("returns not_configured when apiKey is absent", async () => {
		const result = (await call(settingsHandler)) as {
			status: string;
			apiKeyMasked: null;
			apiKeyMode: string;
			webhookSecretConfigured: boolean;
		};
		expect(result.status).toBe("not_configured");
		expect(result.apiKeyMasked).toBeNull();
		expect(result.apiKeyMode).toBe("unknown");
		expect(result.webhookSecretConfigured).toBe(false);
	});

	it("detects test key mode from sk_test_ prefix", async () => {
		mockVerifyConnection.mockResolvedValue({ ok: true, accountName: "Acme" });
		const result = (await call(settingsHandler, {
			apiKey: "sk_test_abc1234567890",
			webhookSecret: "whsec_test",
		})) as { status: string; apiKeyMode: string; apiKeyMasked: string };
		expect(result.apiKeyMode).toBe("test");
		expect(result.status).toBe("connected");
		expect(result.apiKeyMasked).toMatch(/\*+/);
	});

	it("detects live key mode from sk_live_ prefix", async () => {
		mockVerifyConnection.mockResolvedValue({ ok: true, accountName: "Prod" });
		const result = (await call(settingsHandler, {
			apiKey: "sk_live_abc1234567890",
			webhookSecret: "whsec_live",
		})) as { status: string; apiKeyMode: string };
		expect(result.apiKeyMode).toBe("live");
		expect(result.status).toBe("connected");
	});

	it("returns error status when provider verification fails", async () => {
		mockVerifyConnection.mockResolvedValue({
			ok: false,
			error: "Invalid API key",
		});
		const result = (await call(settingsHandler, {
			apiKey: "sk_test_invalid",
			webhookSecret: "whsec_test",
		})) as { status: string; error: string };
		expect(result.status).toBe("error");
		expect(result.error).toBe("Invalid API key");
	});

	it("configures webhook fields when webhookSecret is provided", async () => {
		mockVerifyConnection.mockResolvedValue({ ok: true, accountName: "Test" });
		const result = (await call(settingsHandler, {
			apiKey: "sk_test_abc1234567890",
			webhookSecret: "whsec_abc1234567890",
		})) as { webhookSecretConfigured: boolean; webhookSecretMasked: string };
		expect(result.webhookSecretConfigured).toBe(true);
		expect(result.webhookSecretMasked).toMatch(/\*+/);
	});

	it("does not call provider when apiKey is empty", async () => {
		mockVerifyConnection.mockClear();
		await call(settingsHandler);
		expect(mockVerifyConnection).not.toHaveBeenCalled();
	});
});
