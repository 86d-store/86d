const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

interface PinterestProviderConfig {
	accessToken: string;
	adAccountId?: string | undefined;
	catalogId?: string | undefined;
}

interface PinterestApiError {
	code: number;
	message: string;
}

interface PinterestUserAccount {
	username: string;
	account_type?: "BUSINESS" | "PINNER";
	business_name?: string;
	profile_image?: string;
	website_url?: string;
	board_count?: number;
	pin_count?: number;
	follower_count?: number;
	following_count?: number;
	monthly_views?: number;
}

interface PinterestCatalogItemAttributes {
	title: string;
	description: string;
	link: string;
	image_link: string;
	price: string;
	sale_price?: string;
	availability: "in stock" | "out of stock" | "preorder";
	google_product_category?: string;
	condition?: "new" | "used" | "refurbished";
}

interface PinterestBatchItem {
	item_id: string;
	attributes?: PinterestCatalogItemAttributes;
}

interface PinterestBatchRequest {
	catalog_type: "RETAIL";
	country: string;
	language: string;
	operation: "CREATE" | "UPDATE" | "UPSERT" | "DELETE";
	items: PinterestBatchItem[];
}

interface PinterestBatchResponse {
	batch_id: string;
	status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
	created_time: string;
	completed_time?: string;
	total_count: number;
	success_count: number;
	failure_count: number;
}

interface PinterestBatchStatusResponse extends PinterestBatchResponse {
	items?: Array<{
		item_id: string;
		status: "SUCCESS" | "FAILURE";
		errors?: Array<{ message: string }>;
	}>;
}

interface PinterestCatalogItem {
	item_id: string;
	title: string;
	description: string;
	link: string;
	image_link: string;
	price: string;
	sale_price?: string;
	availability: string;
	google_product_category?: string;
}

interface PinterestCatalogItemsResponse {
	items: PinterestCatalogItem[];
	bookmark?: string;
}

interface PinterestPinMediaSource {
	source_type: "image_url";
	url: string;
}

interface PinterestCreatePinRequest {
	title: string;
	description?: string | undefined;
	link: string;
	board_id?: string | undefined;
	media_source: PinterestPinMediaSource;
}

interface PinterestPin {
	id: string;
	title: string;
	description?: string;
	link: string;
	board_id?: string;
	media?: {
		images?: Record<string, { url: string; width: number; height: number }>;
	};
	created_at: string;
}

interface PinterestPinAnalyticsMetric {
	IMPRESSION?: number;
	SAVE?: number;
	PIN_CLICK?: number;
	OUTBOUND_CLICK?: number;
}

interface PinterestPinAnalyticsResponse {
	all: {
		lifetime_metrics: PinterestPinAnalyticsMetric;
		daily_metrics?: Array<{
			date: string;
			data_status: string;
			metrics: PinterestPinAnalyticsMetric;
		}>;
	};
}

interface PinterestCatalog {
	id: string;
	name: string;
	catalog_type: string;
	created_at: string;
	updated_at: string;
	status: string;
}

interface PinterestCatalogsResponse {
	items: PinterestCatalog[];
	bookmark?: string;
}

export class PinterestApiProvider {
	private readonly config: PinterestProviderConfig;

	constructor(config: PinterestProviderConfig) {
		this.config = config;
	}

	/**
	 * Verify the configured access token against the Pinterest API by calling
	 * GET /user_account. Returns the authenticated account's username and type
	 * so admins can confirm they've connected the right Pinterest identity.
	 */
	async verifyConnection(): Promise<
		| { ok: true; username: string; accountType: "BUSINESS" | "PINNER" }
		| { ok: false; error: string }
	> {
		try {
			const res = await fetch(`${PINTEREST_API_BASE}/user_account`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${this.config.accessToken}`,
					"Content-Type": "application/json",
				},
			});

			if (!res.ok) {
				let message = `HTTP ${res.status}`;
				try {
					const body = (await res.json()) as PinterestApiError;
					if (body?.message) {
						message = body.message;
					}
				} catch {
					// Fall back to HTTP status message
				}
				return { ok: false, error: message };
			}

			const account = (await res.json()) as PinterestUserAccount;
			return {
				ok: true,
				username: account.username,
				accountType: account.account_type ?? "PINNER",
			};
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
	): Promise<T> {
		const url = `${PINTEREST_API_BASE}${path}`;
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.config.accessToken}`,
			"Content-Type": "application/json",
		};

		const response = await fetch(url, {
			method,
			headers,
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		if (!response.ok) {
			let errorMessage = `Pinterest API error (${response.status})`;
			try {
				const errorBody = (await response.json()) as PinterestApiError;
				if (errorBody.message) {
					errorMessage = `Pinterest API error: ${errorBody.message}`;
				}
			} catch {
				// Use default error message
			}
			throw new Error(errorMessage);
		}

		if (response.status === 204) {
			return undefined as T;
		}

		return response.json() as Promise<T>;
	}

	async listCatalogs(): Promise<PinterestCatalogsResponse> {
		return this.request<PinterestCatalogsResponse>("GET", "/catalogs");
	}

	async batchUpsertItems(
		items: Array<{
			itemId: string;
			title: string;
			description: string;
			link: string;
			imageLink: string;
			price: string;
			salePrice?: string;
			availability: "in stock" | "out of stock" | "preorder";
			googleProductCategory?: string;
		}>,
		country = "US",
		language = "en",
	): Promise<PinterestBatchResponse> {
		const batchRequest: PinterestBatchRequest = {
			catalog_type: "RETAIL",
			country,
			language,
			operation: "UPSERT",
			items: items.map((item) => ({
				item_id: item.itemId,
				attributes: {
					title: item.title,
					description: item.description,
					link: item.link,
					image_link: item.imageLink,
					price: item.price,
					...(item.salePrice ? { sale_price: item.salePrice } : {}),
					availability: item.availability,
					...(item.googleProductCategory
						? { google_product_category: item.googleProductCategory }
						: {}),
				},
			})),
		};

		return this.request<PinterestBatchResponse>(
			"POST",
			"/catalogs/items/batch",
			batchRequest,
		);
	}

	async batchDeleteItems(
		itemIds: string[],
		country = "US",
		language = "en",
	): Promise<PinterestBatchResponse> {
		const batchRequest: PinterestBatchRequest = {
			catalog_type: "RETAIL",
			country,
			language,
			operation: "DELETE",
			items: itemIds.map((id) => ({ item_id: id })),
		};

		return this.request<PinterestBatchResponse>(
			"POST",
			"/catalogs/items/batch",
			batchRequest,
		);
	}

	async getBatchStatus(batchId: string): Promise<PinterestBatchStatusResponse> {
		return this.request<PinterestBatchStatusResponse>(
			"GET",
			`/catalogs/items/batch/${encodeURIComponent(batchId)}`,
		);
	}

	async getCatalogItems(
		itemIds: string[],
		country = "US",
		language = "en",
	): Promise<PinterestCatalogItemsResponse> {
		const params = new URLSearchParams({
			country,
			language,
			item_ids: itemIds.join(","),
		});
		return this.request<PinterestCatalogItemsResponse>(
			"GET",
			`/catalogs/items?${params.toString()}`,
		);
	}

	async createPin(params: PinterestCreatePinRequest): Promise<PinterestPin> {
		return this.request<PinterestPin>("POST", "/pins", params);
	}

	async getPin(pinId: string): Promise<PinterestPin> {
		return this.request<PinterestPin>(
			"GET",
			`/pins/${encodeURIComponent(pinId)}`,
		);
	}

	async deletePin(pinId: string): Promise<void> {
		await this.request<void>("DELETE", `/pins/${encodeURIComponent(pinId)}`);
	}

	async getPinAnalytics(
		pinId: string,
		startDate: string,
		endDate: string,
		metricTypes: string[] = [
			"IMPRESSION",
			"SAVE",
			"PIN_CLICK",
			"OUTBOUND_CLICK",
		],
	): Promise<PinterestPinAnalyticsResponse> {
		const params = new URLSearchParams({
			start_date: startDate,
			end_date: endDate,
			metric_types: metricTypes.join(","),
			app_types: "ALL",
		});
		return this.request<PinterestPinAnalyticsResponse>(
			"GET",
			`/pins/${encodeURIComponent(pinId)}/analytics?${params.toString()}`,
		);
	}
}

export function mapAvailabilityToPinterest(
	availability: string,
): "in stock" | "out of stock" | "preorder" {
	switch (availability) {
		case "in-stock":
			return "in stock";
		case "out-of-stock":
			return "out of stock";
		case "preorder":
			return "preorder";
		default:
			return "in stock";
	}
}

export function formatPinterestPrice(price: number, currency = "USD"): string {
	return `${price.toFixed(2)} ${currency}`;
}

export function verifyWebhookSignature(
	payload: string,
	signature: string,
	secret: string,
): boolean {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(secret);
	const messageData = encoder.encode(payload);

	return computeHmacSha256Sync(keyData, messageData, signature);
}

function computeHmacSha256Sync(
	key: Uint8Array,
	message: Uint8Array,
	expectedSignature: string,
): boolean {
	try {
		const hmac = require("node:crypto").createHmac("sha256", key);
		hmac.update(message);
		const computed = hmac.digest("hex");
		const expected = expectedSignature.replace(/^sha256=/, "");
		if (computed.length !== expected.length) return false;

		const computedBuf = Buffer.from(computed, "hex");
		const expectedBuf = Buffer.from(expected, "hex");
		if (computedBuf.length !== expectedBuf.length) return false;

		return require("node:crypto").timingSafeEqual(computedBuf, expectedBuf);
	} catch {
		return false;
	}
}
