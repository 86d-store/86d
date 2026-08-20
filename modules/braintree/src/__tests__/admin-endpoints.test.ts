import { describe, expect, it, vi } from "vitest";
import { getSettings } from "../admin/endpoints/get-settings";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true }),
);

vi.mock("../provider", () => ({
	BraintreePaymentProvider: class {
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

describe("admin GET /braintree/settings", () => {
	it("returns not_configured when all credentials are absent", async () => {
		const result = (await call(settingsHandler)) as {
			status: string;
			merchantIdMasked: null;
			publicKeyMasked: null;
			privateKeyMasked: null;
			mode: string;
		};
		expect(result.status).toBe("not_configured");
		expect(result.merchantIdMasked).toBeNull();
		expect(result.publicKeyMasked).toBeNull();
		expect(result.privateKeyMasked).toBeNull();
	});

	it("returns not_configured when only some credentials are provided", async () => {
		const result = (await call(settingsHandler, {
			merchantId: "merchant123",
		})) as { status: string };
		expect(result.status).toBe("not_configured");
	});

	it("defaults to production mode", async () => {
		const result = (await call(settingsHandler)) as { mode: string };
		expect(result.mode).toBe("production");
	});

	it("returns sandbox mode when sandbox=true", async () => {
		mockVerifyConnection.mockResolvedValue({ ok: true });
		const result = (await call(settingsHandler, {
			merchantId: "merchant123",
			publicKey: "publickey1",
			privateKey: "privatekey1",
			sandbox: "true",
		})) as { mode: string };
		expect(result.mode).toBe("sandbox");
	});

	it("returns connected with masked keys when all credentials valid", async () => {
		mockVerifyConnection.mockResolvedValue({ ok: true });
		const result = (await call(settingsHandler, {
			merchantId: "merchant12345678",
			publicKey: "publickey12345678",
			privateKey: "privatekey12345678",
		})) as {
			status: string;
			merchantIdMasked: string;
			publicKeyMasked: string;
			privateKeyMasked: string;
		};
		expect(result.status).toBe("connected");
		expect(result.merchantIdMasked).toMatch(/\*+/);
		expect(result.publicKeyMasked).toMatch(/\*+/);
		expect(result.privateKeyMasked).toMatch(/\*+/);
	});

	it("returns error when verification fails", async () => {
		mockVerifyConnection.mockResolvedValue({
			ok: false,
			error: "Authentication failed",
		});
		const result = (await call(settingsHandler, {
			merchantId: "merchant123",
			publicKey: "publickey1",
			privateKey: "privatekey1",
		})) as { status: string; error: string };
		expect(result.status).toBe("error");
		expect(result.error).toBe("Authentication failed");
	});

	it("does not call provider when not all credentials are provided", async () => {
		mockVerifyConnection.mockClear();
		await call(settingsHandler, {
			merchantId: "merchant123",
			publicKey: "pubkey",
		});
		expect(mockVerifyConnection).not.toHaveBeenCalled();
	});
});
