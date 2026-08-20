import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	rateLimitCheck: vi.fn(),
	sendEmail: vi.fn(),
	loggerInfo: vi.fn(),
	loggerWarn: vi.fn(),
	getStoreConfig: vi.fn(),
}));

vi.mock("utils/rate-limit", () => ({
	createRateLimiter: () => ({ check: mocks.rateLimitCheck }),
}));

vi.mock("utils/logger", () => ({
	logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn },
}));

vi.mock("utils/sanitize", () => ({
	sanitizeText: (s: string) => s,
}));

vi.mock("~/lib/template-path", () => ({
	resolveTemplatePath: () => "/templates/brisa/config.json",
}));

vi.mock("@86d-app/sdk/get-store-config", () => ({
	getStoreConfig: mocks.getStoreConfig,
}));

vi.mock("emails", () => ({
	default: { emails: { send: mocks.sendEmail } },
}));

vi.mock("emails/contact", () => ({
	default: vi.fn(() => "mock-email-react-element"),
}));

const { POST } = await import("../route");

function makeRequest(
	body: unknown,
	headers: Record<string, string> = {},
): NextRequest {
	return new NextRequest("http://localhost/api/contact", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

describe("POST /api/contact", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.rateLimitCheck.mockReturnValue({
			allowed: true,
			resetAt: Date.now() + 60_000,
		});
		mocks.getStoreConfig.mockResolvedValue({ name: "My Store" });
		mocks.sendEmail.mockResolvedValue({ id: "email-1" });
	});

	describe("rate limiting", () => {
		it("returns 429 when rate limit is exceeded", async () => {
			mocks.rateLimitCheck.mockReturnValue({ allowed: false, resetAt: 0 });

			const response = await POST(
				makeRequest(
					{
						name: "Jane",
						email: "jane@example.com",
						subject: "Hi",
						message: "Hello",
					},
					{ "x-forwarded-for": "1.2.3.4" },
				),
			);

			expect(response.status).toBe(429);
			const body = await response.json();
			expect(body.error.code).toBe("TOO_MANY_REQUESTS");
		});
	});

	describe("invalid JSON", () => {
		it("returns 400 for malformed JSON body", async () => {
			const response = await POST(
				new NextRequest("http://localhost/api/contact", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: "not-json{",
				}),
			);

			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error.code).toBe("BAD_REQUEST");
		});
	});

	describe("validation", () => {
		const validBody = {
			name: "Jane Doe",
			email: "jane@example.com",
			subject: "Inquiry",
			message: "Hello there!",
		};

		it("returns 400 when name is empty", async () => {
			const response = await POST(makeRequest({ ...validBody, name: "" }));
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error.code).toBe("BAD_REQUEST");
			expect(body.error.message).toMatch(/name/i);
		});

		it("returns 400 when email has no @ sign", async () => {
			const response = await POST(
				makeRequest({ ...validBody, email: "not-an-email" }),
			);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error.message).toMatch(/email/i);
		});

		it("returns 400 when subject is empty", async () => {
			const response = await POST(makeRequest({ ...validBody, subject: "" }));
			expect(response.status).toBe(400);
		});

		it("returns 400 when message is empty", async () => {
			const response = await POST(makeRequest({ ...validBody, message: "" }));
			expect(response.status).toBe(400);
		});

		it("returns 400 when body is not an object", async () => {
			const response = await POST(makeRequest(42));
			expect(response.status).toBe(400);
		});
	});

	describe("success path", () => {
		it("returns 200 with success:true on valid submission", async () => {
			const response = await POST(
				makeRequest({
					name: "Jane Doe",
					email: "jane@example.com",
					subject: "Question",
					message: "Hello!",
				}),
			);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.success).toBe(true);
		});

		it("sends confirmation email to the submitter", async () => {
			await POST(
				makeRequest({
					name: "Jane",
					email: "jane@example.com",
					subject: "Hi",
					message: "Hello",
				}),
			);

			expect(mocks.sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: ["jane@example.com"],
					from: expect.stringContaining("My Store"),
				}),
			);
		});

		it("uses store name from config in the from address", async () => {
			mocks.getStoreConfig.mockResolvedValue({ name: "Cool Kicks" });

			await POST(
				makeRequest({
					name: "Bob",
					email: "bob@example.com",
					subject: "Sup",
					message: "Hey",
				}),
			);

			expect(mocks.sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					from: expect.stringContaining("Cool Kicks"),
				}),
			);
		});

		it("falls back to Our Store when config has no name", async () => {
			mocks.getStoreConfig.mockResolvedValue({});

			await POST(
				makeRequest({
					name: "Bob",
					email: "bob@example.com",
					subject: "Sup",
					message: "Hey",
				}),
			);

			expect(mocks.sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					from: expect.stringContaining("Our Store"),
				}),
			);
		});
	});

	describe("email failure (graceful)", () => {
		it("still returns 200 when email sending fails", async () => {
			mocks.sendEmail.mockRejectedValue(new Error("Resend API error"));

			const response = await POST(
				makeRequest({
					name: "Jane",
					email: "jane@example.com",
					subject: "Hi",
					message: "Hello",
				}),
			);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.success).toBe(true);
		});

		it("logs a warning when email sending fails", async () => {
			mocks.sendEmail.mockRejectedValue(new Error("Resend API down"));

			await POST(
				makeRequest({
					name: "Jane",
					email: "jane@example.com",
					subject: "Hi",
					message: "Hello",
				}),
			);

			expect(mocks.loggerWarn).toHaveBeenCalledWith(
				expect.stringContaining("email"),
				expect.any(Object),
			);
		});
	});
});
