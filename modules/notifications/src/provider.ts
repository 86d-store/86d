/**
 * External notification delivery providers.
 * ResendProvider sends emails via https://api.resend.com/emails
 * TwilioProvider sends SMS via https://api.twilio.com/2010-04-01/
 */

// ── Resend types ────────────────────────────────────────────────────────────

export interface ResendSendRequest {
	from: string;
	to: string | string[];
	subject: string;
	html?: string | undefined;
	text?: string | undefined;
	reply_to?: string | undefined;
	tags?: Array<{ name: string; value: string }> | undefined;
}

export interface ResendSendResponse {
	id: string;
}

export interface ResendErrorResponse {
	statusCode: number;
	message: string;
	name: string;
}

// ── Twilio types ────────────────────────────────────────────────────────────

export interface TwilioSendRequest {
	To: string;
	From: string;
	Body: string;
	StatusCallback?: string | undefined;
}

export interface TwilioMessageResponse {
	sid: string;
	account_sid: string;
	to: string;
	from: string;
	body: string;
	status: string;
	error_code: number | null;
	error_message: string | null;
	date_created: string;
	date_sent: string | null;
}

export interface TwilioErrorResponse {
	code: number;
	message: string;
	more_info: string;
	status: number;
}

// ── Delivery result ─────────────────────────────────────────────────────────

export interface DeliveryResult {
	success: boolean;
	messageId?: string | undefined;
	error?: string | undefined;
}

// ── Resend provider ─────────────────────────────────────────────────────────

export class ResendProvider {
	private readonly apiKey: string;
	private readonly fromAddress: string;
	private readonly baseUrl = "https://api.resend.com";

	constructor(apiKey: string, fromAddress: string) {
		this.apiKey = apiKey;
		this.fromAddress = fromAddress;
	}

	async sendEmail(params: {
		to: string | string[];
		subject: string;
		html?: string | undefined;
		text?: string | undefined;
		replyTo?: string | undefined;
		tags?: Array<{ name: string; value: string }> | undefined;
	}): Promise<DeliveryResult> {
		const body: ResendSendRequest = {
			from: this.fromAddress,
			to: params.to,
			subject: params.subject,
			...(params.html ? { html: params.html } : {}),
			...(params.text ? { text: params.text } : {}),
			...(params.replyTo ? { reply_to: params.replyTo } : {}),
			...(params.tags ? { tags: params.tags } : {}),
		};

		const res = await fetch(`${this.baseUrl}/emails`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			const errBody = (await res.json().catch(() => ({
				message: `HTTP ${res.status}`,
			}))) as ResendErrorResponse;
			return {
				success: false,
				error: `Resend error: ${errBody.message ?? `HTTP ${res.status}`}`,
			};
		}

		const data = (await res.json()) as ResendSendResponse;
		return { success: true, messageId: data.id };
	}

	/**
	 * Verify API credentials by listing API keys.
	 */
	async verifyConnection(): Promise<
		{ ok: true; accountName: string } | { ok: false; error: string }
	> {
		try {
			const res = await fetch(`${this.baseUrl}/api-keys`, {
				method: "GET",
				headers: { Authorization: `Bearer ${this.apiKey}` },
			});
			if (!res.ok) {
				const errBody = (await res.json().catch(() => ({
					message: `HTTP ${res.status}`,
				}))) as ResendErrorResponse;
				return {
					ok: false,
					error: `Resend error: ${errBody.message ?? `HTTP ${res.status}`}`,
				};
			}
			return {
				ok: true,
				accountName: `Resend (${this.fromAddress})`,
			};
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : String(e),
			};
		}
	}
}

// ── Twilio provider ─────────────────────────────────────────────────────────

export class TwilioProvider {
	private readonly accountSid: string;
	private readonly authToken: string;
	private readonly fromNumber: string;
	private readonly baseUrl = "https://api.twilio.com/2010-04-01";

	constructor(accountSid: string, authToken: string, fromNumber: string) {
		this.accountSid = accountSid;
		this.authToken = authToken;
		this.fromNumber = fromNumber;
	}

	async sendSms(params: {
		to: string;
		body: string;
		statusCallback?: string | undefined;
	}): Promise<DeliveryResult> {
		const formData = new URLSearchParams();
		formData.set("To", params.to);
		formData.set("From", this.fromNumber);
		formData.set("Body", params.body);
		if (params.statusCallback) {
			formData.set("StatusCallback", params.statusCallback);
		}

		const credentials = btoa(`${this.accountSid}:${this.authToken}`);

		const res = await fetch(
			`${this.baseUrl}/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`,
			{
				method: "POST",
				headers: {
					Authorization: `Basic ${credentials}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: formData.toString(),
			},
		);

		if (!res.ok) {
			const errBody = (await res.json().catch(() => ({
				message: `HTTP ${res.status}`,
			}))) as TwilioErrorResponse;
			return {
				success: false,
				error: `Twilio error: ${errBody.message ?? `HTTP ${res.status}`}`,
			};
		}

		const data = (await res.json()) as TwilioMessageResponse;
		if (data.error_code) {
			return {
				success: false,
				error: `Twilio error ${data.error_code}: ${data.error_message ?? "Unknown"}`,
			};
		}
		return { success: true, messageId: data.sid };
	}

	/**
	 * Verify API credentials by fetching the account resource.
	 */
	async verifyConnection(): Promise<
		{ ok: true; accountName: string } | { ok: false; error: string }
	> {
		try {
			const credentials = btoa(`${this.accountSid}:${this.authToken}`);
			const res = await fetch(
				`${this.baseUrl}/Accounts/${encodeURIComponent(this.accountSid)}.json`,
				{
					method: "GET",
					headers: { Authorization: `Basic ${credentials}` },
				},
			);
			if (!res.ok) {
				const errBody = (await res.json().catch(() => ({
					message: `HTTP ${res.status}`,
				}))) as TwilioErrorResponse;
				return {
					ok: false,
					error: `Twilio error: ${errBody.message ?? `HTTP ${res.status}`}`,
				};
			}
			const data = (await res.json()) as {
				friendly_name: string;
				sid: string;
			};
			return {
				ok: true,
				accountName:
					data.friendly_name || `Twilio (${this.accountSid.slice(0, 8)}...)`,
			};
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : String(e),
			};
		}
	}
}
