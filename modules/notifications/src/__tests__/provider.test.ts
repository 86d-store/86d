import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResendProvider, TwilioProvider } from "../provider";

// ── Resend fixtures ─────────────────────────────────────────────────────────

const RESEND_SUCCESS_RESPONSE = {
	id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
};

const RESEND_ERROR_RESPONSE = {
	statusCode: 422,
	message: "The 'to' field must be a valid email.",
	name: "validation_error",
};

const RESEND_AUTH_ERROR_RESPONSE = {
	statusCode: 403,
	message: "API key is invalid.",
	name: "forbidden",
};

// ── Twilio fixtures ─────────────────────────────────────────────────────────

const TWILIO_SUCCESS_RESPONSE = {
	sid: "twilio_message_sid",
	account_sid: "twilio_account_sid",
	messaging_service_sid: null,
	to: "+15558675310",
	from: "+15551234567",
	body: "Order shipped: Your order #1234 has shipped.",
	status: "queued",
	num_segments: "1",
	num_media: "0",
	direction: "outbound-api",
	api_version: "2010-04-01",
	price: null,
	price_unit: "USD",
	error_code: null,
	error_message: null,
	date_created: "Thu, 30 Jul 2015 20:12:31 +0000",
	date_sent: null,
	date_updated: "Thu, 30 Jul 2015 20:12:31 +0000",
	uri: "/2010-04-01/Accounts/twilio_account_sid/Messages/twilio_message_sid.json",
	subresource_uris: {},
};

const TWILIO_ERROR_RESPONSE = {
	code: 21211,
	message: "The 'To' number +15551234567 is not a valid phone number.",
	more_info: "https://www.twilio.com/docs/errors/21211",
	status: 400,
};

const TWILIO_SEND_ERROR_RESPONSE = {
	...TWILIO_SUCCESS_RESPONSE,
	status: "failed",
	error_code: 30008,
	error_message: "Unknown error",
};

describe("ResendProvider", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it("sends an email with correct request shape", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(RESEND_SUCCESS_RESPONSE), { status: 200 }),
		);

		const provider = new ResendProvider(
			"re_123456789",
			"Store <noreply@store.com>",
		);
		const result = await provider.sendEmail({
			to: "customer@example.com",
			subject: "Order Confirmation",
			html: "<h1>Your order is confirmed</h1>",
			text: "Your order is confirmed",
		});

		expect(result.success).toBe(true);
		expect(result.messageId).toBe("49a3999c-0ce1-4ea6-ab68-afcd6dc2e794");

		expect(fetchSpy).toHaveBeenCalledOnce();
		const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.resend.com/emails");
		expect(options.method).toBe("POST");

		const headers = options.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer re_123456789");
		expect(headers["Content-Type"]).toBe("application/json");

		const body = JSON.parse(options.body as string);
		expect(body.from).toBe("Store <noreply@store.com>");
		expect(body.to).toBe("customer@example.com");
		expect(body.subject).toBe("Order Confirmation");
		expect(body.html).toBe("<h1>Your order is confirmed</h1>");
		expect(body.text).toBe("Your order is confirmed");
	});

	it("sends to multiple recipients", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(RESEND_SUCCESS_RESPONSE), { status: 200 }),
		);

		const provider = new ResendProvider("re_test", "noreply@store.com");
		await provider.sendEmail({
			to: ["a@example.com", "b@example.com"],
			subject: "Sale",
			text: "Big sale",
		});

		const body = JSON.parse(
			(fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
		);
		expect(body.to).toEqual(["a@example.com", "b@example.com"]);
	});

	it("includes optional tags and reply_to", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(RESEND_SUCCESS_RESPONSE), { status: 200 }),
		);

		const provider = new ResendProvider("re_test", "noreply@store.com");
		await provider.sendEmail({
			to: "customer@example.com",
			subject: "Test",
			text: "Hello",
			replyTo: "support@store.com",
			tags: [{ name: "campaign", value: "spring-sale" }],
		});

		const body = JSON.parse(
			(fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
		);
		expect(body.reply_to).toBe("support@store.com");
		expect(body.tags).toEqual([{ name: "campaign", value: "spring-sale" }]);
	});

	it("returns error on validation failure", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(RESEND_ERROR_RESPONSE), { status: 422 }),
		);

		const provider = new ResendProvider("re_test", "noreply@store.com");
		const result = await provider.sendEmail({
			to: "not-an-email",
			subject: "Test",
			text: "Hello",
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("The 'to' field must be a valid email");
	});

	it("returns error on auth failure", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(RESEND_AUTH_ERROR_RESPONSE), { status: 403 }),
		);

		const provider = new ResendProvider("re_invalid", "noreply@store.com");
		const result = await provider.sendEmail({
			to: "customer@example.com",
			subject: "Test",
			text: "Hello",
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("API key is invalid");
	});

	it("handles network failure gracefully", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response("Internal Server Error", { status: 500 }),
		);

		const provider = new ResendProvider("re_test", "noreply@store.com");
		const result = await provider.sendEmail({
			to: "customer@example.com",
			subject: "Test",
			text: "Hello",
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("Resend error");
	});

	describe("verifyConnection", () => {
		it("returns ok with from address when API responds", async () => {
			fetchSpy.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [] }), { status: 200 }),
			);

			const provider = new ResendProvider("re_test", "noreply@store.com");
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				accountName: "Resend (noreply@store.com)",
			});

			const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toBe("https://api.resend.com/api-keys");
			expect(options.method).toBe("GET");
		});

		it("returns error when API key is invalid", async () => {
			fetchSpy.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						statusCode: 403,
						message: "API key is invalid.",
						name: "forbidden",
					}),
					{ status: 403 },
				),
			);

			const provider = new ResendProvider("re_invalid", "noreply@store.com");
			const result = await provider.verifyConnection();

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("API key is invalid");
			}
		});

		it("returns error on network failure", async () => {
			fetchSpy.mockRejectedValueOnce(new Error("Network request failed"));

			const provider = new ResendProvider("re_test", "noreply@store.com");
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Network request failed",
			});
		});
	});
});

describe("TwilioProvider", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it("sends an SMS with correct request shape", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(TWILIO_SUCCESS_RESPONSE), { status: 201 }),
		);

		const provider = new TwilioProvider(
			"twilio_account_sid",
			"auth_token_123",
			"+15551234567",
		);
		const result = await provider.sendSms({
			to: "+15558675310",
			body: "Order shipped: Your order #1234 has shipped.",
		});

		expect(result.success).toBe(true);
		expect(result.messageId).toBe("twilio_message_sid");

		expect(fetchSpy).toHaveBeenCalledOnce();
		const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(
			"https://api.twilio.com/2010-04-01/Accounts/twilio_account_sid/Messages.json",
		);
		expect(options.method).toBe("POST");

		const headers = options.headers as Record<string, string>;
		const expectedAuth = btoa("twilio_account_sid:auth_token_123");
		expect(headers.Authorization).toBe(`Basic ${expectedAuth}`);
		expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

		const params = new URLSearchParams(options.body as string);
		expect(params.get("To")).toBe("+15558675310");
		expect(params.get("From")).toBe("+15551234567");
		expect(params.get("Body")).toBe(
			"Order shipped: Your order #1234 has shipped.",
		);
	});

	it("includes status callback when provided", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(TWILIO_SUCCESS_RESPONSE), { status: 201 }),
		);

		const provider = new TwilioProvider("ACtest", "token", "+15551234567");
		await provider.sendSms({
			to: "+15558675310",
			body: "Hello",
			statusCallback: "https://store.com/webhooks/sms",
		});

		const params = new URLSearchParams(
			(fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
		);
		expect(params.get("StatusCallback")).toBe("https://store.com/webhooks/sms");
	});

	it("returns error on invalid phone number", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(TWILIO_ERROR_RESPONSE), { status: 400 }),
		);

		const provider = new TwilioProvider("ACtest", "token", "+15551234567");
		const result = await provider.sendSms({
			to: "+15551234567",
			body: "Hello",
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("not a valid phone number");
	});

	it("returns error when Twilio responds with error_code", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(TWILIO_SEND_ERROR_RESPONSE), {
				status: 201,
			}),
		);

		const provider = new TwilioProvider("ACtest", "token", "+15551234567");
		const result = await provider.sendSms({
			to: "+15558675310",
			body: "Hello",
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("30008");
	});

	it("handles network failure gracefully", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response("Server Error", { status: 500 }),
		);

		const provider = new TwilioProvider("ACtest", "token", "+15551234567");
		const result = await provider.sendSms({
			to: "+15558675310",
			body: "Hello",
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("Twilio error");
	});

	describe("verifyConnection", () => {
		it("returns ok with account name when API responds", async () => {
			fetchSpy.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						friendly_name: "My Business",
						sid: "AC123",
					}),
					{ status: 200 },
				),
			);

			const provider = new TwilioProvider("AC123", "token", "+15551234567");
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				accountName: "My Business",
			});

			const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123.json");
		});

		it("returns error when API returns 401", async () => {
			fetchSpy.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						code: 20003,
						message: "Authenticate",
						status: 401,
					}),
					{ status: 401 },
				),
			);

			const provider = new TwilioProvider("AC123", "bad-token", "+15551234567");
			const result = await provider.verifyConnection();

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("Authenticate");
			}
		});

		it("returns error on network failure", async () => {
			fetchSpy.mockRejectedValueOnce(new Error("Network request failed"));

			const provider = new TwilioProvider("AC123", "token", "+15551234567");
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Network request failed",
			});
		});
	});
});
