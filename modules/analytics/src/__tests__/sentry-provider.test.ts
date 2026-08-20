import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSentryDsn, SentryProvider } from "../providers/sentry";

describe("parseSentryDsn", () => {
	it("parses a well-formed sentry.io DSN", () => {
		const result = parseSentryDsn(
			"https://abc123def456@o123.ingest.sentry.io/456",
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.dsn.publicKey).toBe("abc123def456");
		expect(result.dsn.host).toBe("o123.ingest.sentry.io");
		expect(result.dsn.projectId).toBe("456");
		expect(result.dsn.protocol).toBe("https");
		expect(result.dsn.envelopeUrl).toBe(
			"https://o123.ingest.sentry.io/api/456/envelope/",
		);
	});

	it("parses a self-hosted DSN on a custom port over http", () => {
		const result = parseSentryDsn("http://key@sentry.local:9000/42");
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.dsn.host).toBe("sentry.local:9000");
		expect(result.dsn.protocol).toBe("http");
		expect(result.dsn.envelopeUrl).toBe(
			"http://sentry.local:9000/api/42/envelope/",
		);
	});

	it("rejects a non-URL string", () => {
		const result = parseSentryDsn("not a url");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/valid URL/i);
	});

	it("rejects unsupported schemes", () => {
		const result = parseSentryDsn("ftp://key@host/1");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/http/i);
	});

	it("rejects a DSN without a public key", () => {
		const result = parseSentryDsn("https://o123.ingest.sentry.io/456");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/public key/i);
	});

	it("rejects a DSN without a project id", () => {
		const result = parseSentryDsn("https://key@o123.ingest.sentry.io/");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/project id/i);
	});

	it("rejects a DSN with a non-numeric project id", () => {
		const result = parseSentryDsn("https://key@o123.ingest.sentry.io/abc");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/numeric/i);
	});
});

describe("SentryProvider.verifyConnection", () => {
	const DSN = "https://publicKey@o123.ingest.sentry.io/456";
	let fetchSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function provider(): SentryProvider {
		const built = SentryProvider.fromDsn(DSN);
		if (!built.ok) throw new Error("expected valid DSN in test");
		return built.provider;
	}

	it("returns ok with the event id when Sentry accepts the envelope", async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ id: "abc123def456" }),
		});

		const result = await provider().verifyConnection();

		expect(result.ok).toBe(true);
		expect(result.eventId).toBe("abc123def456");
		expect(fetchSpy).toHaveBeenCalledOnce();
	});

	it("posts to the envelope endpoint derived from the DSN", async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ id: "x" }),
		});

		await provider().verifyConnection();

		const [url, init] = fetchSpy.mock.calls[0] as [
			string,
			RequestInit & { headers: Record<string, string>; body: string },
		];
		expect(url).toBe("https://o123.ingest.sentry.io/api/456/envelope/");
		expect(init.method).toBe("POST");
		expect(init.headers["Content-Type"]).toBe("application/x-sentry-envelope");
		expect(init.headers["X-Sentry-Auth"]).toContain("sentry_key=publicKey");
		expect(init.headers["X-Sentry-Auth"]).toContain("sentry_version=7");
	});

	it("includes the connection-check tag and environment in the event payload", async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ id: "x" }),
		});

		await provider().verifyConnection();

		const body = (fetchSpy.mock.calls[0] as [string, { body: string }])[1].body;
		const lines = body.split("\n").filter((l) => l.length > 0);
		expect(lines).toHaveLength(3);
		const envelopeHeader = JSON.parse(lines[0]) as {
			event_id: string;
			sent_at: string;
			dsn: string;
		};
		expect(envelopeHeader.dsn).toBe(DSN);
		expect(envelopeHeader.event_id).toMatch(/^[a-f0-9]{32}$/);
		const itemHeader = JSON.parse(lines[1]) as {
			type: string;
			content_type: string;
			length: number;
		};
		expect(itemHeader.type).toBe("event");
		expect(itemHeader.content_type).toBe("application/json");
		expect(itemHeader.length).toBeGreaterThan(0);
		const event = JSON.parse(lines[2]) as {
			level: string;
			tags: Record<string, string>;
			environment: string;
		};
		expect(event.level).toBe("info");
		expect(event.tags["86d.connection_check"]).toBe("true");
		expect(event.environment).toBe("connection-check");
	});

	it("falls back to the sent event id when Sentry returns no body", async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 202,
			json: () => Promise.reject(new Error("no body")),
		});

		const result = await provider().verifyConnection();

		expect(result.ok).toBe(true);
		expect(result.eventId).toMatch(/^[a-f0-9]{32}$/);
	});

	it("reports an auth error on 401", async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: () => Promise.resolve(""),
		});

		const result = await provider().verifyConnection();

		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/401|public key/i);
	});

	it("reports an auth error on 403", async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: false,
			status: 403,
			text: () => Promise.resolve(""),
		});

		const result = await provider().verifyConnection();

		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/401|public key/i);
	});

	it("reports rate limiting on 429", async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: false,
			status: 429,
			text: () => Promise.resolve(""),
		});

		const result = await provider().verifyConnection();

		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/429|rate-limited/i);
	});

	it("reports the HTTP status and body excerpt on other errors", async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: () => Promise.resolve("internal error details"),
		});

		const result = await provider().verifyConnection();

		expect(result.ok).toBe(false);
		expect(result.error).toContain("HTTP 500");
		expect(result.error).toContain("internal error details");
	});

	it("returns an error when fetch throws", async () => {
		fetchSpy.mockRejectedValueOnce(new Error("Network down"));

		const result = await provider().verifyConnection();

		expect(result.ok).toBe(false);
		expect(result.error).toBe("Network down");
	});
});

describe("SentryProvider.fromDsn", () => {
	it("returns a provider for a valid DSN", () => {
		const built = SentryProvider.fromDsn("https://k@o.sentry.io/9");
		expect(built.ok).toBe(true);
		if (!built.ok) return;
		expect(built.provider.getParsedDsn().projectId).toBe("9");
	});

	it("propagates a parse error for an invalid DSN", () => {
		const built = SentryProvider.fromDsn("https://o.sentry.io/9");
		expect(built.ok).toBe(false);
		if (built.ok) return;
		expect(built.error).toMatch(/public key/i);
	});
});
