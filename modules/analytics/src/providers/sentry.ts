/**
 * Sentry envelope API provider.
 *
 * Verifies a DSN by sending a minimal event to the Sentry envelope endpoint.
 * Docs:
 *   - DSN format: https://docs.sentry.io/product/sentry-basics/dsn-explainer/
 *   - Envelope spec: https://develop.sentry.dev/sdk/envelopes/
 *   - Auth header: https://develop.sentry.dev/sdk/overview/#authentication
 */

export interface ParsedSentryDsn {
	publicKey: string;
	host: string;
	projectId: string;
	protocol: "http" | "https";
	envelopeUrl: string;
}

export type DsnParseResult =
	| { ok: true; dsn: ParsedSentryDsn }
	| { ok: false; error: string };

export function parseSentryDsn(raw: string): DsnParseResult {
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return { ok: false, error: "DSN is not a valid URL" };
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		return { ok: false, error: "DSN must use http(s)" };
	}
	if (!parsed.username) {
		return { ok: false, error: "DSN is missing the public key" };
	}
	const projectId = parsed.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
	if (!projectId) {
		return { ok: false, error: "DSN is missing the project id" };
	}
	if (!/^\d+$/.test(projectId)) {
		return { ok: false, error: "DSN project id must be numeric" };
	}
	const protocol = parsed.protocol === "https:" ? "https" : "http";
	return {
		ok: true,
		dsn: {
			publicKey: parsed.username,
			host: parsed.host,
			projectId,
			protocol,
			envelopeUrl: `${protocol}://${parsed.host}/api/${projectId}/envelope/`,
		},
	};
}

export interface SentryVerifyResult {
	ok: boolean;
	eventId?: string;
	error?: string;
}

const CLIENT_NAME = "86d-analytics";
const CLIENT_VERSION = "1.0";

/**
 * Build the `X-Sentry-Auth` header value used by all ingestion requests.
 */
function buildAuthHeader(publicKey: string): string {
	return `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=${CLIENT_NAME}/${CLIENT_VERSION}`;
}

interface EnvelopeEventPayload {
	event_id: string;
	timestamp: number;
	platform: string;
	level: "debug" | "info" | "warning" | "error" | "fatal";
	message: { formatted: string };
	tags: Record<string, string>;
	environment?: string;
}

/**
 * Serialize an envelope containing a single event item. Each newline-delimited
 * JSON line is a required part of the Sentry envelope format.
 */
function serializeEventEnvelope(
	dsn: ParsedSentryDsn,
	event: EnvelopeEventPayload,
): string {
	const eventJson = JSON.stringify(event);
	const envelopeHeader = JSON.stringify({
		event_id: event.event_id,
		sent_at: new Date(event.timestamp * 1000).toISOString(),
		dsn: `${dsn.protocol}://${dsn.publicKey}@${dsn.host}/${dsn.projectId}`,
	});
	const itemHeader = JSON.stringify({
		type: "event",
		content_type: "application/json",
		length: new TextEncoder().encode(eventJson).length,
	});
	return `${envelopeHeader}\n${itemHeader}\n${eventJson}\n`;
}

function randomEventId(): string {
	return crypto.randomUUID().replace(/-/g, "");
}

export class SentryProvider {
	private readonly dsn: ParsedSentryDsn;

	constructor(dsn: ParsedSentryDsn) {
		this.dsn = dsn;
	}

	/**
	 * Create a provider from a raw DSN string. Returns null when the DSN
	 * cannot be parsed.
	 */
	static fromDsn(
		raw: string,
	): { ok: true; provider: SentryProvider } | { ok: false; error: string } {
		const result = parseSentryDsn(raw);
		if (!result.ok) return result;
		return { ok: true, provider: new SentryProvider(result.dsn) };
	}

	getParsedDsn(): ParsedSentryDsn {
		return this.dsn;
	}

	/**
	 * Send a minimal tagged event to the envelope endpoint and check the
	 * response. The event is tagged `86d.connection_check=true` so operators
	 * can filter or delete it in the Sentry project.
	 *
	 * Sentry accepts a valid DSN with `202 Accepted`, rejects bad auth with
	 * `401`, and returns `429` when rate-limited. Any other non-2xx is
	 * surfaced as an error.
	 */
	async verifyConnection(): Promise<SentryVerifyResult> {
		const event: EnvelopeEventPayload = {
			event_id: randomEventId(),
			timestamp: Math.floor(Date.now() / 1000),
			platform: "javascript",
			level: "info",
			message: { formatted: "86d analytics connection check" },
			tags: { "86d.connection_check": "true" },
			environment: "connection-check",
		};
		const body = serializeEventEnvelope(this.dsn, event);

		let res: Response;
		try {
			res = await fetch(this.dsn.envelopeUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-sentry-envelope",
					"X-Sentry-Auth": buildAuthHeader(this.dsn.publicKey),
				},
				body,
			});
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}

		if (res.status === 401 || res.status === 403) {
			return {
				ok: false,
				error: "Sentry rejected the DSN public key (401)",
			};
		}
		if (res.status === 429) {
			return {
				ok: false,
				error: "Sentry rate-limited the connection check (429)",
			};
		}
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			return {
				ok: false,
				error: `Sentry error: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}`,
			};
		}

		// Sentry returns `{ id: "<event-id-without-hyphens>" }` on success. We
		// tolerate a missing body (some proxies strip it) and fall back to the
		// event id we sent.
		const responseId = await res
			.json()
			.then((b) =>
				typeof b === "object" &&
				b !== null &&
				typeof (b as { id?: unknown }).id === "string"
					? (b as { id: string }).id
					: null,
			)
			.catch(() => null);

		return { ok: true, eventId: responseId ?? event.event_id };
	}
}
