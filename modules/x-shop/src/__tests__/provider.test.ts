import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	XApiCreateTweetResponse,
	XApiDeleteTweetResponse,
	XApiGetTweetResponse,
	XApiGetUserResponse,
	XApiTokenResponse,
	XApiTweetData,
} from "../provider";
import {
	computeWebhookCrc,
	extractTweetMetrics,
	verifyWebhookSignature,
	XApiProvider,
} from "../provider";

// ── Realistic X API v2 response fixtures ────────────────────────────────────

const OAUTH_TOKEN_RESPONSE: XApiTokenResponse = {
	access_token: "TjFHRkNIVkJGVkVJQk1OV0c6MTpjaQ-R0VULWdyYW50LXR5cGUtc2VydmljZQ",
	refresh_token:
		"bWxjQUd6NGJSWVE3OXdvdGNNTTQ6MTpydA-R0VULWdyYW50LXR5cGUtcmVmcmVzaA",
	token_type: "bearer",
	expires_in: 7200,
	scope: "tweet.read tweet.write users.read offline.access",
};

const CREATE_TWEET_RESPONSE: XApiCreateTweetResponse = {
	data: {
		id: "1780605018753536001",
		text: "New drop: Limited Edition Sneakers\n\nExclusive release, only 100 pairs available!",
	},
};

const GET_TWEET_RESPONSE: XApiGetTweetResponse = {
	data: {
		id: "1780605018753536001",
		text: "New drop: Limited Edition Sneakers\n\nExclusive release, only 100 pairs available!",
		edit_history_tweet_ids: ["1780605018753536001"],
		created_at: "2024-04-17T15:30:00.000Z",
		public_metrics: {
			retweet_count: 42,
			reply_count: 15,
			like_count: 287,
			quote_count: 8,
			bookmark_count: 53,
			impression_count: 14832,
		},
		non_public_metrics: {
			impression_count: 14832,
			url_link_clicks: 523,
			user_profile_clicks: 91,
		},
		organic_metrics: {
			impression_count: 14500,
			retweet_count: 40,
			reply_count: 14,
			like_count: 280,
			url_link_clicks: 510,
			user_profile_clicks: 88,
		},
	},
};

const DELETE_TWEET_RESPONSE: XApiDeleteTweetResponse = {
	data: {
		deleted: true,
	},
};

const GET_USER_RESPONSE: XApiGetUserResponse = {
	data: {
		id: "2244994945",
		name: "86d Store",
		username: "86d_store",
		profile_image_url:
			"https://pbs.twimg.com/profile_images/abc/photo_normal.jpg",
		public_metrics: {
			followers_count: 1523,
			following_count: 47,
			tweet_count: 312,
			listed_count: 18,
		},
	},
};

const X_API_ERROR_RESPONSE = {
	title: "Forbidden",
	detail: "You are not permitted to perform this action.",
	type: "about:blank",
	status: 403,
};

const X_API_VALIDATION_ERROR_RESPONSE = {
	errors: [
		{
			message: "Invalid value for tweet.text: text is too long",
			parameters: { "tweet.text": ["..."] },
		},
	],
};

// ── Provider tests ───────────────────────────────────────────────────────────

describe("XApiProvider", () => {
	let provider: XApiProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new XApiProvider({
			apiKey: "ck-test-abc123def456",
			apiSecret: "cs-test-ghi789jkl012",
			accessToken: "at-test-mno345pqr678",
			refreshToken: "rt-test-stu901vwx234",
		});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function mockFetchSequence(
		...responses: {
			ok: boolean;
			status: number;
			body: unknown;
		}[]
	) {
		const mock = vi.fn();
		for (const resp of responses) {
			mock.mockResolvedValueOnce({
				ok: resp.ok,
				status: resp.status,
				json: () => Promise.resolve(resp.body),
				text: () => Promise.resolve(resp.body ? JSON.stringify(resp.body) : ""),
			});
		}
		globalThis.fetch = mock;
		return mock;
	}

	function mockApiCall(apiResponse: unknown, status = 200) {
		return mockFetchSequence({
			ok: status >= 200 && status < 300,
			status,
			body: apiResponse,
		});
	}

	function mockApiCallWithTokenRefresh(apiResponse: unknown, status = 200) {
		return mockFetchSequence(
			{ ok: true, status: 200, body: OAUTH_TOKEN_RESPONSE },
			{
				ok: status >= 200 && status < 300,
				status,
				body: apiResponse,
			},
		);
	}

	// ── Verify connection ──────────────────────────────────────────────

	describe("verifyConnection", () => {
		it("returns ok with user metadata on success", async () => {
			const mock = mockApiCall(GET_USER_RESPONSE);
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				userId: "2244994945",
				username: "86d_store",
				name: "86d Store",
			});

			const call = mock.mock.calls[0];
			expect(call[0]).toBe(
				"https://api.twitter.com/2/users/me?user.fields=name,username",
			);
			expect(call[1]?.method).toBe("GET");
			expect(
				(call[1]?.headers as Record<string, string> | undefined)?.Authorization,
			).toBe("Bearer at-test-mno345pqr678");
		});

		it("returns error with detail message on 401", async () => {
			mockApiCall(
				{
					title: "Unauthorized",
					type: "about:blank",
					status: 401,
					detail: "Unauthorized",
				},
				401,
			);
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Unauthorized",
			});
		});

		it("falls back to errors[0].message when detail missing", async () => {
			mockApiCall(
				{
					errors: [{ message: "Invalid or expired token" }],
				},
				401,
			);
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Invalid or expired token",
			});
		});

		it("returns error with HTTP status when body is not JSON", async () => {
			globalThis.fetch = vi.fn().mockResolvedValueOnce({
				ok: false,
				status: 503,
				json: () => Promise.reject(new Error("invalid json")),
			});
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "HTTP 503",
			});
		});

		it("returns error when fetch throws", async () => {
			globalThis.fetch = vi
				.fn()
				.mockRejectedValueOnce(new Error("network unreachable"));
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "network unreachable",
			});
		});
	});

	// ── Authentication ──────────────────────────────────────────────────

	describe("authentication", () => {
		it("uses existing access token without refresh for first request", async () => {
			const mock = mockApiCall(GET_USER_RESPONSE);

			await provider.getMe();

			expect(mock).toHaveBeenCalledTimes(1);
			const call = mock.mock.calls[0];
			expect(call[0]).toBe(
				"https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url,name,username",
			);
			expect(call[1]?.headers?.Authorization).toBe(
				"Bearer at-test-mno345pqr678",
			);
		});

		it("refreshes token using Basic auth when token has expired", async () => {
			// Force token expiry by setting tokenExpiresAt to a past value (not 0)
			const expiredProvider = new XApiProvider({
				apiKey: "ck-test-abc123def456",
				apiSecret: "cs-test-ghi789jkl012",
				accessToken: "at-expired",
				refreshToken: "rt-test-stu901vwx234",
			});
			// Set to a non-zero past value to trigger refresh logic
			Object.assign(expiredProvider, { tokenExpiresAt: 1 });

			const mock = mockApiCallWithTokenRefresh(GET_USER_RESPONSE);

			await expiredProvider.getMe();

			expect(mock).toHaveBeenCalledTimes(2);

			// First call: token refresh
			const tokenCall = mock.mock.calls[0];
			expect(tokenCall[0]).toBe("https://api.twitter.com/2/oauth2/token");
			expect(tokenCall[1]?.method).toBe("POST");

			const authHeader = tokenCall[1]?.headers?.Authorization as string;
			expect(authHeader).toMatch(/^Basic /);
			const decoded = atob(authHeader.replace("Basic ", ""));
			expect(decoded).toBe("ck-test-abc123def456:cs-test-ghi789jkl012");

			const bodyStr = tokenCall[1]?.body as string;
			expect(bodyStr).toContain("grant_type=refresh_token");
			expect(bodyStr).toContain("refresh_token=rt-test-stu901vwx234");

			// Second call: API call with new token
			const apiCall = mock.mock.calls[1];
			expect(apiCall[1]?.headers?.Authorization).toBe(
				`Bearer ${OAUTH_TOKEN_RESPONSE.access_token}`,
			);
		});

		it("reuses cached token when not expired", async () => {
			// Force a refresh on first call, then second call should reuse cached token
			const mock = mockFetchSequence(
				// Token refresh for first call
				{ ok: true, status: 200, body: OAUTH_TOKEN_RESPONSE },
				{ ok: true, status: 200, body: GET_USER_RESPONSE },
				// Second call should reuse cached token — no refresh needed
				{ ok: true, status: 200, body: GET_TWEET_RESPONSE },
			);

			// Create provider with expired state (non-zero past value) to force refresh
			const p = new XApiProvider({
				apiKey: "ck-test",
				apiSecret: "cs-test",
				accessToken: "at-old",
				refreshToken: "rt-test",
			});
			Object.assign(p, { tokenExpiresAt: 1 });

			await p.getMe();
			await p.getTweet("1780605018753536001");

			// Should be 3 calls: token refresh + first API + second API (no refresh)
			expect(mock).toHaveBeenCalledTimes(3);
		});

		it("throws on token refresh failure", async () => {
			mockFetchSequence({
				ok: false,
				status: 401,
				body: null,
			});

			const p = new XApiProvider({
				apiKey: "ck-test",
				apiSecret: "cs-test",
				accessToken: "at-old",
				refreshToken: "rt-bad",
			});
			// Force expired state to trigger refresh
			Object.assign(p, { tokenExpiresAt: 1 });

			await expect(p.getMe()).rejects.toThrow(
				"X OAuth token refresh error: HTTP 401",
			);
		});

		it("skips token refresh when no refresh token is provided", async () => {
			const noRefreshProvider = new XApiProvider({
				apiKey: "ck-test",
				apiSecret: "cs-test",
				accessToken: "at-valid-token",
			});

			const mock = mockApiCall(GET_USER_RESPONSE);

			await noRefreshProvider.getMe();

			// Only one call — no token refresh
			expect(mock).toHaveBeenCalledTimes(1);
			expect(mock.mock.calls[0][1]?.headers?.Authorization).toBe(
				"Bearer at-valid-token",
			);
		});
	});

	// ── postTweet ───────────────────────────────────────────────────────

	describe("postTweet", () => {
		it("posts a tweet with text only", async () => {
			const mock = mockApiCall(CREATE_TWEET_RESPONSE);

			const result = await provider.postTweet(
				"New drop: Limited Edition Sneakers\n\nExclusive release, only 100 pairs available!",
			);

			expect(result.data.id).toBe("1780605018753536001");
			expect(result.data.text).toContain("Limited Edition Sneakers");

			const call = mock.mock.calls[0];
			expect(call[0]).toBe("https://api.twitter.com/2/tweets");
			expect(call[1]?.method).toBe("POST");

			const body = JSON.parse(call[1]?.body as string);
			expect(body.text).toContain("Limited Edition Sneakers");
			expect(body.media).toBeUndefined();
		});

		it("posts a tweet with media IDs", async () => {
			const mock = mockApiCall(CREATE_TWEET_RESPONSE);

			await provider.postTweet("Check out our new product!", {
				mediaIds: ["1234567890", "0987654321"],
			});

			const body = JSON.parse(mock.mock.calls[0][1]?.body as string);
			expect(body.media).toEqual({
				media_ids: ["1234567890", "0987654321"],
			});
		});

		it("posts a reply to an existing tweet", async () => {
			const mock = mockApiCall(CREATE_TWEET_RESPONSE);

			await provider.postTweet("This is a reply!", {
				replyToTweetId: "1780605018753536000",
			});

			const body = JSON.parse(mock.mock.calls[0][1]?.body as string);
			expect(body.reply).toEqual({
				in_reply_to_tweet_id: "1780605018753536000",
			});
		});

		it("posts a quote tweet", async () => {
			const mock = mockApiCall(CREATE_TWEET_RESPONSE);

			await provider.postTweet("Amazing deal!", {
				quoteTweetId: "1780605018753536000",
			});

			const body = JSON.parse(mock.mock.calls[0][1]?.body as string);
			expect(body.quote_tweet_id).toBe("1780605018753536000");
		});

		it("throws on API error with detail message", async () => {
			mockApiCall(X_API_ERROR_RESPONSE, 403);

			await expect(provider.postTweet("test")).rejects.toThrow(
				"X API error: You are not permitted to perform this action.",
			);
		});

		it("throws on validation error with first error message", async () => {
			mockApiCall(X_API_VALIDATION_ERROR_RESPONSE, 400);

			await expect(provider.postTweet("x".repeat(300))).rejects.toThrow(
				"X API error: Invalid value for tweet.text: text is too long",
			);
		});
	});

	// ── deleteTweet ─────────────────────────────────────────────────────

	describe("deleteTweet", () => {
		it("deletes a tweet by ID", async () => {
			const mock = mockApiCall(DELETE_TWEET_RESPONSE);

			const result = await provider.deleteTweet("1780605018753536001");

			expect(result.data.deleted).toBe(true);

			const call = mock.mock.calls[0];
			expect(call[0]).toBe(
				"https://api.twitter.com/2/tweets/1780605018753536001",
			);
			expect(call[1]?.method).toBe("DELETE");
		});

		it("throws when tweet does not exist", async () => {
			mockApiCall(
				{
					detail: "Not Found",
					title: "Not Found Error",
					status: 404,
				},
				404,
			);

			await expect(provider.deleteTweet("9999999999999999999")).rejects.toThrow(
				"X API error: Not Found",
			);
		});
	});

	// ── getTweet ────────────────────────────────────────────────────────

	describe("getTweet", () => {
		it("gets a tweet with all metric fields", async () => {
			const mock = mockApiCall(GET_TWEET_RESPONSE);

			const result = await provider.getTweet("1780605018753536001");

			expect(result.data.id).toBe("1780605018753536001");
			expect(result.data.public_metrics?.impression_count).toBe(14832);
			expect(result.data.public_metrics?.like_count).toBe(287);
			expect(result.data.public_metrics?.retweet_count).toBe(42);
			expect(result.data.non_public_metrics?.url_link_clicks).toBe(523);
			expect(result.data.created_at).toBe("2024-04-17T15:30:00.000Z");

			const call = mock.mock.calls[0];
			expect(call[0]).toContain("/tweets/1780605018753536001?tweet.fields=");
			expect(call[0]).toContain("public_metrics");
			expect(call[0]).toContain("non_public_metrics");
			expect(call[0]).toContain("organic_metrics");
			expect(call[0]).toContain("created_at");
		});

		it("throws on 404 for non-existent tweet", async () => {
			mockApiCall({ detail: "Not Found" }, 404);

			await expect(provider.getTweet("0000000000000000000")).rejects.toThrow(
				"X API error: Not Found",
			);
		});
	});

	// ── getMe ───────────────────────────────────────────────────────────

	describe("getMe", () => {
		it("returns authenticated user profile with metrics", async () => {
			const mock = mockApiCall(GET_USER_RESPONSE);

			const result = await provider.getMe();

			expect(result.data.id).toBe("2244994945");
			expect(result.data.name).toBe("86d Store");
			expect(result.data.username).toBe("86d_store");
			expect(result.data.public_metrics?.followers_count).toBe(1523);
			expect(result.data.public_metrics?.tweet_count).toBe(312);
			expect(result.data.profile_image_url).toContain("pbs.twimg.com");

			const call = mock.mock.calls[0];
			expect(call[0]).toContain("/users/me?user.fields=");
			expect(call[0]).toContain("public_metrics");
			expect(call[0]).toContain("profile_image_url");
		});

		it("throws on 401 unauthorized", async () => {
			// Use provider without refresh token so 401 hits the API path directly
			const noRefreshProvider = new XApiProvider({
				apiKey: "ck-test",
				apiSecret: "cs-test",
				accessToken: "at-bad-token",
			});

			mockApiCall({ detail: "Unauthorized" }, 401);

			await expect(noRefreshProvider.getMe()).rejects.toThrow(
				"X API error: Unauthorized",
			);
		});
	});
});

// ── extractTweetMetrics ─────────────────────────────────────────────────────

describe("extractTweetMetrics", () => {
	it("extracts all metrics from a complete tweet response", () => {
		const metrics = extractTweetMetrics(GET_TWEET_RESPONSE.data);

		expect(metrics).toEqual({
			impressions: 14832,
			clicks: 523,
			likes: 287,
			retweets: 42,
			replies: 15,
			quotes: 8,
			bookmarks: 53,
		});
	});

	it("returns zeros when no metrics are present", () => {
		const tweet: XApiTweetData = {
			id: "123",
			text: "Hello",
		};

		const metrics = extractTweetMetrics(tweet);

		expect(metrics).toEqual({
			impressions: 0,
			clicks: 0,
			likes: 0,
			retweets: 0,
			replies: 0,
			quotes: 0,
			bookmarks: 0,
		});
	});

	it("prefers public_metrics impression_count over non_public_metrics", () => {
		const tweet: XApiTweetData = {
			id: "123",
			text: "Hello",
			public_metrics: {
				impression_count: 1000,
				retweet_count: 0,
				reply_count: 0,
				like_count: 0,
				quote_count: 0,
				bookmark_count: 0,
			},
			non_public_metrics: {
				impression_count: 500,
				url_link_clicks: 10,
			},
		};

		const metrics = extractTweetMetrics(tweet);
		expect(metrics.impressions).toBe(1000);
		expect(metrics.clicks).toBe(10);
	});

	it("falls back to non_public_metrics when public_metrics is missing", () => {
		const tweet: XApiTweetData = {
			id: "123",
			text: "Hello",
			non_public_metrics: {
				impression_count: 750,
				url_link_clicks: 25,
			},
		};

		const metrics = extractTweetMetrics(tweet);
		expect(metrics.impressions).toBe(750);
		expect(metrics.clicks).toBe(25);
	});
});

// ── Webhook CRC verification ────────────────────────────────────────────────

describe("computeWebhookCrc", () => {
	it("generates sha256 HMAC in base64 format", () => {
		const result = computeWebhookCrc("test_token_123", "my_api_secret");

		expect(result).toMatch(/^sha256=.+$/);
		expect(result.length).toBeGreaterThan(10);
	});

	it("produces consistent output for same inputs", () => {
		const result1 = computeWebhookCrc("crc_token_abc", "secret_xyz");
		const result2 = computeWebhookCrc("crc_token_abc", "secret_xyz");

		expect(result1).toBe(result2);
	});

	it("produces different output for different tokens", () => {
		const result1 = computeWebhookCrc("token_a", "secret");
		const result2 = computeWebhookCrc("token_b", "secret");

		expect(result1).not.toBe(result2);
	});
});

describe("verifyWebhookSignature", () => {
	it("returns true for valid signature", () => {
		const secret = "test_secret_key";
		const payload = '{"event":"tweet.created","data":{}}';

		// Generate expected signature
		const crypto = require("node:crypto");
		const hmac = crypto.createHmac("sha256", secret);
		hmac.update(payload);
		const validSignature = `sha256=${hmac.digest("base64")}`;

		expect(verifyWebhookSignature(payload, validSignature, secret)).toBe(true);
	});

	it("returns false for invalid signature", () => {
		const secret = "test_secret_key";
		const payload = '{"event":"tweet.created"}';

		expect(
			verifyWebhookSignature(payload, "sha256=invalid_signature", secret),
		).toBe(false);
	});

	it("returns false for tampered payload", () => {
		const secret = "test_secret_key";
		const originalPayload = '{"event":"tweet.created"}';
		const tamperedPayload = '{"event":"tweet.deleted"}';

		const crypto = require("node:crypto");
		const hmac = crypto.createHmac("sha256", secret);
		hmac.update(originalPayload);
		const signature = `sha256=${hmac.digest("base64")}`;

		expect(verifyWebhookSignature(tamperedPayload, signature, secret)).toBe(
			false,
		);
	});
});
