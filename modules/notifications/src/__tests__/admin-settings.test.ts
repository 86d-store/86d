import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(ep: unknown): (
	ctx: Record<string, unknown>,
) => Promise<{
	email: {
		status: string;
		error: string | undefined;
		accountName: string | undefined;
		configured: boolean;
		provider: string;
		fromAddress: string | null;
		apiKeyMasked: string | null;
	};
	sms: {
		status: string;
		error: string | undefined;
		accountName: string | undefined;
		configured: boolean;
		provider: string;
		fromNumber: string | null;
		accountSidMasked: string | null;
	};
}> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<{
		email: {
			status: string;
			error: string | undefined;
			accountName: string | undefined;
			configured: boolean;
			provider: string;
			fromAddress: string | null;
			apiKeyMasked: string | null;
		};
		sms: {
			status: string;
			error: string | undefined;
			accountName: string | undefined;
			configured: boolean;
			provider: string;
			fromNumber: string | null;
			accountSidMasked: string | null;
		};
	}>;
}

function callSettings(options: {
	resendApiKey?: string;
	resendFromAddress?: string;
	twilioAccountSid?: string;
	twilioAuthToken?: string;
	twilioFromNumber?: string;
}) {
	const endpoint = createGetSettingsEndpoint(options);
	const handler = extractHandler(endpoint);
	return handler({ context: {} });
}

// ── Resend (email) fixture helpers ────────────────────────────────────────────

function resendOkResponse() {
	return new Response(
		JSON.stringify({ data: [{ id: "key_1", name: "default" }] }),
		{ status: 200 },
	);
}

function resendErrorResponse(status: number, message: string) {
	return new Response(
		JSON.stringify({ statusCode: status, message, name: "Error" }),
		{ status },
	);
}

// ── Twilio (SMS) fixture helpers ──────────────────────────────────────────────

function twilioOkResponse(friendlyName = "My Account", sid = "AC123") {
	return new Response(JSON.stringify({ friendly_name: friendlyName, sid }), {
		status: 200,
	});
}

function twilioErrorResponse(status: number, message: string) {
	return new Response(
		JSON.stringify({
			code: status,
			message,
			more_info: "",
			status,
		}),
		{ status },
	);
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ── Email (Resend) connection verification ────────────────────────────────────

describe("notifications settings — email (Resend)", () => {
	it('returns "connected" when Resend API responds OK', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resendOkResponse());

		const result = await callSettings({
			resendApiKey: "re_abc123xyz",
			resendFromAddress: "hello@example.com",
		});

		expect(result.email.status).toBe("connected");
		expect(result.email.configured).toBe(true);
		expect(result.email.error).toBeUndefined();
		expect(result.email.accountName).toContain("hello@example.com");
	});

	it('returns "not_configured" when resendApiKey is missing', async () => {
		const result = await callSettings({
			resendFromAddress: "hello@example.com",
		});

		expect(result.email.status).toBe("not_configured");
		expect(result.email.configured).toBe(false);
		expect(result.email.error).toBeUndefined();
	});

	it('returns "not_configured" when resendFromAddress is missing', async () => {
		const result = await callSettings({
			resendApiKey: "re_abc123xyz",
		});

		expect(result.email.status).toBe("not_configured");
		expect(result.email.configured).toBe(false);
	});

	it('returns "not_configured" when both email credentials are absent', async () => {
		const result = await callSettings({});

		expect(result.email.status).toBe("not_configured");
		expect(result.email.configured).toBe(false);
	});

	it('returns "error" when Resend returns 401 Unauthorized', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			resendErrorResponse(401, "Unauthorized"),
		);

		const result = await callSettings({
			resendApiKey: "re_bad_key",
			resendFromAddress: "hello@example.com",
		});

		expect(result.email.status).toBe("error");
		expect(result.email.configured).toBe(true);
		expect(typeof result.email.error).toBe("string");
		expect(result.email.error).toContain("Unauthorized");
	});

	it('returns "error" when Resend returns 403 Forbidden', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			resendErrorResponse(403, "Forbidden"),
		);

		const result = await callSettings({
			resendApiKey: "re_restricted_key",
			resendFromAddress: "hello@example.com",
		});

		expect(result.email.status).toBe("error");
		expect(result.email.error).toContain("Forbidden");
	});

	it('returns "error" when Resend fetch throws a network error', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);

		const result = await callSettings({
			resendApiKey: "re_abc123xyz",
			resendFromAddress: "hello@example.com",
		});

		expect(result.email.status).toBe("error");
		expect(result.email.error).toContain("Network failure");
	});

	it("does not call fetch when email is not configured", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		await callSettings({});

		// fetch should only be called for the SMS check (also not configured here)
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

// ── SMS (Twilio) connection verification ──────────────────────────────────────

describe("notifications settings — SMS (Twilio)", () => {
	it('returns "connected" when Twilio API responds OK', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			twilioOkResponse("My Account", "AC123abc"),
		);

		const result = await callSettings({
			twilioAccountSid: "AC123abc",
			twilioAuthToken: "auth_token_xyz",
			twilioFromNumber: "+15005550006",
		});

		expect(result.sms.status).toBe("connected");
		expect(result.sms.configured).toBe(true);
		expect(result.sms.error).toBeUndefined();
		expect(result.sms.accountName).toBe("My Account");
	});

	it("uses friendly_name from Twilio response as accountName", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			twilioOkResponse("Acme Corp SMS", "ACabc123"),
		);

		const result = await callSettings({
			twilioAccountSid: "ACabc123",
			twilioAuthToken: "token",
			twilioFromNumber: "+15005550006",
		});

		expect(result.sms.accountName).toBe("Acme Corp SMS");
	});

	it('returns "not_configured" when twilioAccountSid is missing', async () => {
		const result = await callSettings({
			twilioAuthToken: "auth_token",
			twilioFromNumber: "+15005550006",
		});

		expect(result.sms.status).toBe("not_configured");
		expect(result.sms.configured).toBe(false);
	});

	it('returns "not_configured" when twilioAuthToken is missing', async () => {
		const result = await callSettings({
			twilioAccountSid: "AC123",
			twilioFromNumber: "+15005550006",
		});

		expect(result.sms.status).toBe("not_configured");
		expect(result.sms.configured).toBe(false);
	});

	it('returns "not_configured" when twilioFromNumber is missing', async () => {
		const result = await callSettings({
			twilioAccountSid: "AC123",
			twilioAuthToken: "auth_token",
		});

		expect(result.sms.status).toBe("not_configured");
		expect(result.sms.configured).toBe(false);
	});

	it('returns "not_configured" when all SMS credentials are absent', async () => {
		const result = await callSettings({});

		expect(result.sms.status).toBe("not_configured");
		expect(result.sms.configured).toBe(false);
	});

	it('returns "error" when Twilio returns 401 Unauthorized', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			twilioErrorResponse(401, "Unauthorized"),
		);

		const result = await callSettings({
			twilioAccountSid: "AC123",
			twilioAuthToken: "bad_token",
			twilioFromNumber: "+15005550006",
		});

		expect(result.sms.status).toBe("error");
		expect(result.sms.configured).toBe(true);
		expect(typeof result.sms.error).toBe("string");
		expect(result.sms.error).toContain("Unauthorized");
	});

	it('returns "error" when Twilio fetch throws a network error', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Connection refused"),
		);

		const result = await callSettings({
			twilioAccountSid: "AC123",
			twilioAuthToken: "auth_token",
			twilioFromNumber: "+15005550006",
		});

		expect(result.sms.status).toBe("error");
		expect(result.sms.error).toContain("Connection refused");
	});

	it("does not call fetch when SMS is not configured", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		await callSettings({});

		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

// ── Both providers simultaneously ────────────────────────────────────────────

describe("notifications settings — both providers", () => {
	it("shows correct status for both when both are fully configured and connected", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(resendOkResponse()) // email check first
			.mockResolvedValueOnce(twilioOkResponse("Acme", "AC999")); // SMS check second

		const result = await callSettings({
			resendApiKey: "re_abc123xyz",
			resendFromAddress: "hello@example.com",
			twilioAccountSid: "AC999",
			twilioAuthToken: "token",
			twilioFromNumber: "+15005550006",
		});

		expect(result.email.status).toBe("connected");
		expect(result.email.configured).toBe(true);
		expect(result.sms.status).toBe("connected");
		expect(result.sms.configured).toBe(true);
	});

	it("returns not_configured for both when neither has credentials", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({});

		expect(result.email.status).toBe("not_configured");
		expect(result.email.configured).toBe(false);
		expect(result.sms.status).toBe("not_configured");
		expect(result.sms.configured).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("email connected + SMS not configured when only email credentials present", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resendOkResponse());

		const result = await callSettings({
			resendApiKey: "re_abc123xyz",
			resendFromAddress: "hello@example.com",
		});

		expect(result.email.status).toBe("connected");
		expect(result.sms.status).toBe("not_configured");
	});

	it("email not_configured + SMS connected when only SMS credentials present", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			twilioOkResponse("My Account", "AC123"),
		);

		const result = await callSettings({
			twilioAccountSid: "AC123",
			twilioAuthToken: "token",
			twilioFromNumber: "+15005550006",
		});

		expect(result.email.status).toBe("not_configured");
		expect(result.sms.status).toBe("connected");
	});

	it("email error + SMS connected when email key is bad", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(resendErrorResponse(401, "Unauthorized")) // email
			.mockResolvedValueOnce(twilioOkResponse("Acme", "AC123")); // SMS

		const result = await callSettings({
			resendApiKey: "re_bad",
			resendFromAddress: "hello@example.com",
			twilioAccountSid: "AC123",
			twilioAuthToken: "token",
			twilioFromNumber: "+15005550006",
		});

		expect(result.email.status).toBe("error");
		expect(result.sms.status).toBe("connected");
	});

	it("email connected + SMS error when Twilio token is bad", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(resendOkResponse()) // email
			.mockResolvedValueOnce(twilioErrorResponse(401, "Unauthorized")); // SMS

		const result = await callSettings({
			resendApiKey: "re_abc123xyz",
			resendFromAddress: "hello@example.com",
			twilioAccountSid: "AC123",
			twilioAuthToken: "bad_token",
			twilioFromNumber: "+15005550006",
		});

		expect(result.email.status).toBe("connected");
		expect(result.sms.status).toBe("error");
	});
});

// ── Static response fields ────────────────────────────────────────────────────

describe("notifications settings — static response fields", () => {
	it("always reports provider as 'resend' for email", async () => {
		const result = await callSettings({});
		expect(result.email.provider).toBe("resend");
	});

	it("always reports provider as 'twilio' for SMS", async () => {
		const result = await callSettings({});
		expect(result.sms.provider).toBe("twilio");
	});

	it("returns fromAddress when configured", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resendOkResponse());
		const result = await callSettings({
			resendApiKey: "re_abc123xyz",
			resendFromAddress: "hello@example.com",
		});
		expect(result.email.fromAddress).toBe("hello@example.com");
	});

	it("returns null fromAddress when not configured", async () => {
		const result = await callSettings({});
		expect(result.email.fromAddress).toBeNull();
	});

	it("returns fromNumber when configured", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			twilioErrorResponse(401, "Unauthorized"),
		);
		const result = await callSettings({
			twilioAccountSid: "AC123",
			twilioAuthToken: "token",
			twilioFromNumber: "+15005550006",
		});
		expect(result.sms.fromNumber).toBe("+15005550006");
	});

	it("returns null fromNumber when not configured", async () => {
		const result = await callSettings({});
		expect(result.sms.fromNumber).toBeNull();
	});
});

// ── Credential masking ────────────────────────────────────────────────────────

describe("notifications settings — credential masking", () => {
	it("masks resend API key: preserves first 8 chars, replaces rest with asterisks", async () => {
		const result = await callSettings({
			resendApiKey: "re_live_abc123xyz789",
			resendFromAddress: "hello@example.com",
		});

		expect(result.email.apiKeyMasked).not.toBeNull();
		expect(result.email.apiKeyMasked).toMatch(/\*/);
		expect(result.email.apiKeyMasked).toMatch(/^re_live_/);
		expect(result.email.apiKeyMasked).not.toBe("re_live_abc123xyz789");
	});

	it("returns null apiKeyMasked when resendApiKey is absent", async () => {
		const result = await callSettings({});
		expect(result.email.apiKeyMasked).toBeNull();
	});

	it("masks short resend API key (<=8 chars) as '****'", async () => {
		const result = await callSettings({
			resendApiKey: "short",
			resendFromAddress: "hello@example.com",
		});

		expect(result.email.apiKeyMasked).toBe("****");
	});

	it("masks Twilio accountSid: preserves first 8 chars, replaces rest with asterisks", async () => {
		const result = await callSettings({
			twilioAccountSid: "AC1234567890abcdef",
			twilioAuthToken: "token",
			twilioFromNumber: "+15005550006",
		});

		expect(result.sms.accountSidMasked).not.toBeNull();
		expect(result.sms.accountSidMasked).toMatch(/\*/);
		expect(result.sms.accountSidMasked).toMatch(/^AC123456/);
		expect(result.sms.accountSidMasked).not.toBe("AC1234567890abcdef");
	});

	it("returns null accountSidMasked when twilioAccountSid is absent", async () => {
		const result = await callSettings({});
		expect(result.sms.accountSidMasked).toBeNull();
	});

	it("masks short Twilio accountSid (<=8 chars) as '****'", async () => {
		// twilioAuthToken and twilioFromNumber still absent → not_configured, but masking still applies
		const result = await callSettings({
			twilioAccountSid: "AC1234",
		});

		expect(result.sms.accountSidMasked).toBe("****");
	});

	it("caps asterisk count at 20 for a very long Resend API key", async () => {
		const longKey = `re_live_${"a".repeat(50)}`;
		const result = await callSettings({
			resendApiKey: longKey,
			resendFromAddress: "hello@example.com",
		});

		// maskKey caps at 20 asterisks after the first 8 chars
		const masked = result.email.apiKeyMasked ?? "";
		const asterisks = (masked.match(/\*/g) ?? []).length;
		expect(asterisks).toBeLessThanOrEqual(20);
		expect(masked.startsWith("re_live_")).toBe(true);
	});

	it("caps asterisk count at 20 for a very long Twilio accountSid", async () => {
		const longSid = `AC123456${"b".repeat(50)}`;
		const result = await callSettings({
			twilioAccountSid: longSid,
		});

		const masked = result.sms.accountSidMasked ?? "";
		const asterisks = (masked.match(/\*/g) ?? []).length;
		expect(asterisks).toBeLessThanOrEqual(20);
		expect(masked.startsWith("AC123456")).toBe(true);
	});
});
