/**
 * X (Twitter) API v2 provider.
 * Makes real HTTP calls to the X API for tweet management, analytics, and user info.
 * Authentication uses OAuth 2.0 with user-context access tokens.
 */

// ── X API response types ────────────────────────────────────────────────────

export interface XApiTweetData {
	id: string;
	text: string;
	edit_history_tweet_ids?: string[];
	public_metrics?: XApiTweetPublicMetrics;
	non_public_metrics?: XApiTweetNonPublicMetrics;
	organic_metrics?: XApiTweetOrganicMetrics;
	created_at?: string;
}

export interface XApiTweetPublicMetrics {
	retweet_count: number;
	reply_count: number;
	like_count: number;
	quote_count: number;
	bookmark_count: number;
	impression_count: number;
}

export interface XApiTweetNonPublicMetrics {
	impression_count: number;
	url_link_clicks?: number;
	user_profile_clicks?: number;
}

export interface XApiTweetOrganicMetrics {
	impression_count: number;
	retweet_count: number;
	reply_count: number;
	like_count: number;
	url_link_clicks?: number;
	user_profile_clicks?: number;
}

export interface XApiCreateTweetResponse {
	data: {
		id: string;
		text: string;
	};
}

export interface XApiGetTweetResponse {
	data: XApiTweetData;
}

export interface XApiDeleteTweetResponse {
	data: {
		deleted: boolean;
	};
}

export interface XApiUserData {
	id: string;
	name: string;
	username: string;
	profile_image_url?: string;
	public_metrics?: {
		followers_count: number;
		following_count: number;
		tweet_count: number;
		listed_count: number;
	};
}

export interface XApiGetUserResponse {
	data: XApiUserData;
}

export interface XApiTokenResponse {
	access_token: string;
	refresh_token?: string;
	token_type: string;
	expires_in: number;
	scope: string;
}

export interface XApiErrorResponse {
	detail?: string;
	title?: string;
	type?: string;
	status?: number;
	errors?: Array<{
		message: string;
		parameters?: Record<string, string[]>;
	}>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const X_API_BASE = "https://api.twitter.com/2";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

// ── Provider class ───────────────────────────────────────────────────────────

export interface XApiProviderConfig {
	apiKey: string;
	apiSecret: string;
	accessToken: string;
	refreshToken?: string | undefined;
}

export class XApiProvider {
	private readonly apiKey: string;
	private readonly apiSecret: string;
	private accessToken: string;
	private refreshToken: string | undefined;
	private tokenExpiresAt = 0;

	constructor(config: XApiProviderConfig) {
		this.apiKey = config.apiKey;
		this.apiSecret = config.apiSecret;
		this.accessToken = config.accessToken;
		this.refreshToken = config.refreshToken;
	}

	/**
	 * Verify the configured access token against the X API v2 by calling
	 * GET /users/me. Returns the authenticated user's id and username so
	 * admins can confirm they've connected the right account.
	 */
	async verifyConnection(): Promise<
		| { ok: true; userId: string; username: string; name: string }
		| { ok: false; error: string }
	> {
		try {
			const res = await fetch(
				`${X_API_BASE}/users/me?user.fields=name,username`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${this.accessToken}`,
						"Content-Type": "application/json",
					},
				},
			);

			if (!res.ok) {
				let message = `HTTP ${res.status}`;
				try {
					const body = (await res.json()) as XApiErrorResponse;
					if (body?.detail) {
						message = body.detail;
					} else if (body?.errors?.[0]?.message) {
						message = body.errors[0].message;
					} else if (body?.title) {
						message = body.title;
					}
				} catch {
					// Fall back to HTTP status message
				}
				return { ok: false, error: message };
			}

			const body = (await res.json()) as XApiGetUserResponse;
			return {
				ok: true,
				userId: body.data.id,
				username: body.data.username,
				name: body.data.name,
			};
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}

	/** Refresh the access token using the refresh token. */
	private async ensureAccessToken(): Promise<string> {
		// tokenExpiresAt === 0 means we haven't refreshed yet — use the initial token
		if (this.tokenExpiresAt === 0 || Date.now() < this.tokenExpiresAt) {
			return this.accessToken;
		}

		if (!this.refreshToken) {
			return this.accessToken;
		}

		const credentials = btoa(`${this.apiKey}:${this.apiSecret}`);
		const res = await fetch(X_TOKEN_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${credentials}`,
			},
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: this.refreshToken,
				client_id: this.apiKey,
			}).toString(),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(
				`X OAuth token refresh error: HTTP ${res.status} ${text}`.trim(),
			);
		}

		const data = (await res.json()) as XApiTokenResponse;
		this.accessToken = data.access_token;
		if (data.refresh_token) {
			this.refreshToken = data.refresh_token;
		}
		this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
		return this.accessToken;
	}

	/** Make an authenticated request to the X API v2. */
	private async request<T>(
		method: "GET" | "POST" | "DELETE",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const token = await this.ensureAccessToken();
		const res = await fetch(`${X_API_BASE}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		if (!res.ok) {
			const errBody = (await res
				.json()
				.catch(() => null)) as XApiErrorResponse | null;
			const msg =
				errBody?.detail ??
				errBody?.errors?.[0]?.message ??
				`HTTP ${res.status}`;
			throw new Error(`X API error: ${msg}`);
		}

		if (res.status === 204) return undefined as T;

		const text = await res.text();
		if (!text) return undefined as T;
		return JSON.parse(text) as T;
	}

	// ── Tweets ──────────────────────────────────────────────────────────

	/** Post a new tweet. Returns the created tweet data. */
	async postTweet(
		text: string,
		options?: {
			mediaIds?: string[] | undefined;
			replyToTweetId?: string | undefined;
			quoteTweetId?: string | undefined;
		},
	): Promise<XApiCreateTweetResponse> {
		const body: Record<string, unknown> = { text };

		if (options?.mediaIds?.length) {
			body.media = { media_ids: options.mediaIds };
		}
		if (options?.replyToTweetId) {
			body.reply = { in_reply_to_tweet_id: options.replyToTweetId };
		}
		if (options?.quoteTweetId) {
			body.quote_tweet_id = options.quoteTweetId;
		}

		return this.request<XApiCreateTweetResponse>("POST", "/tweets", body);
	}

	/** Delete a tweet by ID. */
	async deleteTweet(tweetId: string): Promise<XApiDeleteTweetResponse> {
		return this.request<XApiDeleteTweetResponse>(
			"DELETE",
			`/tweets/${encodeURIComponent(tweetId)}`,
		);
	}

	/** Get a tweet by ID, including public and non-public metrics. */
	async getTweet(tweetId: string): Promise<XApiGetTweetResponse> {
		const fields = [
			"public_metrics",
			"non_public_metrics",
			"organic_metrics",
			"created_at",
		].join(",");

		return this.request<XApiGetTweetResponse>(
			"GET",
			`/tweets/${encodeURIComponent(tweetId)}?tweet.fields=${fields}`,
		);
	}

	// ── Users ───────────────────────────────────────────────────────────

	/** Get the authenticated user's profile. */
	async getMe(): Promise<XApiGetUserResponse> {
		const fields = [
			"public_metrics",
			"profile_image_url",
			"name",
			"username",
		].join(",");

		return this.request<XApiGetUserResponse>(
			"GET",
			`/users/me?user.fields=${fields}`,
		);
	}
}

// ── Webhook CRC verification ────────────────────────────────────────────────

/**
 * Verify an X webhook CRC (Challenge-Response Check).
 * X sends a GET request with a crc_token; the app must respond with
 * sha256 HMAC of the crc_token using the API secret as the key.
 */
export function computeWebhookCrc(crcToken: string, apiSecret: string): string {
	const crypto = require("node:crypto");
	const hmac = crypto.createHmac("sha256", apiSecret);
	hmac.update(crcToken);
	return `sha256=${hmac.digest("base64")}`;
}

/**
 * Verify a webhook signature from X.
 * X sends webhooks with an x-twitter-webhooks-signature header containing
 * a sha256 HMAC of the payload body.
 */
export function verifyWebhookSignature(
	payload: string,
	signature: string,
	apiSecret: string,
): boolean {
	try {
		const crypto = require("node:crypto");
		const hmac = crypto.createHmac("sha256", apiSecret);
		hmac.update(payload);
		const expected = `sha256=${hmac.digest("base64")}`;

		if (expected.length !== signature.length) return false;

		const expectedBuf = Buffer.from(expected);
		const signatureBuf = Buffer.from(signature);
		if (expectedBuf.length !== signatureBuf.length) return false;

		return crypto.timingSafeEqual(expectedBuf, signatureBuf);
	} catch {
		return false;
	}
}

// ── Mapping helpers ─────────────────────────────────────────────────────────

/** Extract metrics from a tweet response into a simplified stats object. */
export function extractTweetMetrics(tweet: XApiTweetData): {
	impressions: number;
	clicks: number;
	likes: number;
	retweets: number;
	replies: number;
	quotes: number;
	bookmarks: number;
} {
	const pub = tweet.public_metrics;
	const nonPub = tweet.non_public_metrics;

	return {
		impressions: pub?.impression_count ?? nonPub?.impression_count ?? 0,
		clicks: nonPub?.url_link_clicks ?? 0,
		likes: pub?.like_count ?? 0,
		retweets: pub?.retweet_count ?? 0,
		replies: pub?.reply_count ?? 0,
		quotes: pub?.quote_count ?? 0,
		bookmarks: pub?.bookmark_count ?? 0,
	};
}
