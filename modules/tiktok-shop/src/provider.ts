/**
 * TikTok Shop OpenAPI provider.
 * Makes real HTTP calls to the TikTok Shop API.
 * Authentication uses HMAC-SHA256 request signing with app_key + app_secret.
 */

// ── TikTok Shop API types ──────────────────────────────────────────────────

export interface TikTokProduct {
	id: string;
	title: string;
	description?: string | undefined;
	status: number;
	skus?: TikTokProductSku[] | undefined;
	category_id?: string | undefined;
	brand?: { id?: string; name?: string } | undefined;
	create_time?: number | undefined;
	update_time?: number | undefined;
}

export interface TikTokProductSku {
	id: string;
	seller_sku?: string | undefined;
	price: { amount: string; currency: string };
	inventory?: { quantity: number }[] | undefined;
}

export interface TikTokProductCreateParams {
	title: string;
	description: string;
	category_id: string;
	images: { uri: string }[];
	skus: {
		seller_sku: string;
		price: { amount: string; currency: string };
		inventory: { warehouse_id: string; quantity: number }[];
	}[];
	package_weight?: { value: string; unit: string } | undefined;
}

export interface TikTokOrder {
	id: string;
	status: number;
	create_time: number;
	update_time: number;
	payment?: {
		total_amount: string;
		shipping_fee: string;
		platform_discount: string;
		currency: string;
	};
	recipient_address?: {
		name: string;
		phone?: string | undefined;
		full_address: string;
		region_code?: string | undefined;
		city?: string | undefined;
		state?: string | undefined;
		zipcode?: string | undefined;
	};
	line_items?: TikTokOrderItem[] | undefined;
	buyer_message?: string | undefined;
}

export interface TikTokOrderItem {
	id: string;
	product_id: string;
	product_name: string;
	sku_id: string;
	seller_sku?: string | undefined;
	quantity: number;
	sale_price: string;
	platform_discount?: string | undefined;
	seller_discount?: string | undefined;
}

export interface TikTokApiResponse<T> {
	code: number;
	message: string;
	data?: T | undefined;
	request_id?: string | undefined;
}

export interface TikTokPaginatedData<T> {
	total_count?: number | undefined;
	next_page_token?: string | undefined;
	list?: T[] | undefined;
}

// ── Constants ───────────────────────────────────────────────────────────────

const API_BASE_PRODUCTION = "https://open-api.tiktokglobalshop.com";
const API_BASE_SANDBOX = "https://open-api-sandbox.tiktokglobalshop.com";

// ── Provider class ──────────────────────────────────────────────────────────

export interface TikTokShopProviderConfig {
	appKey: string;
	appSecret: string;
	accessToken: string;
	shopId: string;
	sandbox?: boolean | undefined;
}

export class TikTokShopProvider {
	private readonly appKey: string;
	private readonly appSecret: string;
	private readonly accessToken: string;
	readonly shopId: string;
	private readonly baseUrl: string;

	constructor(config: TikTokShopProviderConfig) {
		this.appKey = config.appKey;
		this.appSecret = config.appSecret;
		this.accessToken = config.accessToken;
		this.shopId = config.shopId;
		this.baseUrl = config.sandbox ? API_BASE_SANDBOX : API_BASE_PRODUCTION;
	}

	/** Generate HMAC-SHA256 signature for request. */
	private async sign(
		path: string,
		params: Record<string, string>,
		body?: string,
	): Promise<string> {
		const sortedKeys = Object.keys(params).sort();
		let signString = path;
		for (const key of sortedKeys) {
			signString += key + params[key];
		}
		if (body) signString += body;

		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(this.appSecret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const signature = await crypto.subtle.sign(
			"HMAC",
			key,
			encoder.encode(signString),
		);
		return Array.from(new Uint8Array(signature))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	private async request<T>(
		method: "GET" | "POST" | "PUT" | "DELETE",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const queryParams: Record<string, string> = {
			app_key: this.appKey,
			timestamp,
			shop_id: this.shopId,
			access_token: this.accessToken,
			version: "202309",
		};

		const bodyStr = body ? JSON.stringify(body) : undefined;
		const sign = await this.sign(path, queryParams, bodyStr);
		queryParams.sign = sign;

		const query = new URLSearchParams(queryParams).toString();
		const url = `${this.baseUrl}${path}?${query}`;

		const res = await fetch(url, {
			method,
			...(bodyStr
				? {
						headers: { "Content-Type": "application/json" },
						body: bodyStr,
					}
				: {}),
		});

		const result = (await res.json()) as TikTokApiResponse<T>;

		if (result.code !== 0) {
			throw new Error(
				`TikTok Shop API error: ${result.message} (code ${result.code})`,
			);
		}

		return result.data as T;
	}

	// ── Connection verification ──────────────────────────────────────────

	/**
	 * Verify that the credentials are valid by listing products.
	 */
	async verifyConnection(): Promise<
		{ ok: true; shopId: string } | { ok: false; error: string }
	> {
		try {
			await this.listProducts({ page_size: 1 });
			return { ok: true, shopId: this.shopId };
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}

	// ── Product operations ────────────────────────────────────────────────

	/** Create a product. */
	async createProduct(
		params: TikTokProductCreateParams,
	): Promise<{ product_id: string }> {
		return this.request<{ product_id: string }>(
			"POST",
			"/product/202309/products",
			params as unknown as Record<string, unknown>,
		);
	}

	/** Update a product. */
	async updateProduct(
		productId: string,
		params: Partial<TikTokProductCreateParams>,
	): Promise<{ product_id: string }> {
		return this.request<{ product_id: string }>(
			"PUT",
			`/product/202309/products/${encodeURIComponent(productId)}`,
			params as unknown as Record<string, unknown>,
		);
	}

	/** Delete (deactivate) a product. */
	async deleteProduct(
		productId: string,
	): Promise<{ deleted_product_ids: string[] }> {
		return this.request<{ deleted_product_ids: string[] }>(
			"DELETE",
			`/product/202309/products`,
			{ product_ids: [productId] },
		);
	}

	/** List products. */
	async listProducts(params?: {
		page_size?: number | undefined;
		page_token?: string | undefined;
	}): Promise<TikTokPaginatedData<TikTokProduct>> {
		return this.request<TikTokPaginatedData<TikTokProduct>>(
			"POST",
			"/product/202309/products/search",
			{
				page_size: params?.page_size ?? 50,
				...(params?.page_token ? { page_token: params.page_token } : {}),
			},
		);
	}

	/** Get a single product. */
	async getProduct(productId: string): Promise<TikTokProduct> {
		return this.request<TikTokProduct>(
			"GET",
			`/product/202309/products/${encodeURIComponent(productId)}`,
		);
	}

	// ── Order operations ──────────────────────────────────────────────────

	/** List orders. */
	async listOrders(params?: {
		page_size?: number | undefined;
		page_token?: string | undefined;
		order_status?: number | undefined;
		create_time_ge?: number | undefined;
		create_time_lt?: number | undefined;
	}): Promise<TikTokPaginatedData<TikTokOrder>> {
		return this.request<TikTokPaginatedData<TikTokOrder>>(
			"POST",
			"/order/202309/orders/search",
			{
				page_size: params?.page_size ?? 50,
				...(params?.page_token ? { page_token: params.page_token } : {}),
				...(params?.order_status !== undefined
					? { order_status: params.order_status }
					: {}),
				...(params?.create_time_ge !== undefined
					? { create_time_ge: params.create_time_ge }
					: {}),
				...(params?.create_time_lt !== undefined
					? { create_time_lt: params.create_time_lt }
					: {}),
			},
		);
	}

	/** Get order details. */
	async getOrderDetail(orderId: string): Promise<TikTokOrder> {
		return this.request<TikTokOrder>(
			"GET",
			`/order/202309/orders/${encodeURIComponent(orderId)}`,
		);
	}

	/** Ship an order (create package/shipment). */
	async shipOrder(
		orderId: string,
		params: {
			tracking_number: string;
			shipping_provider_id: string;
		},
	): Promise<{ package_id: string }> {
		return this.request<{ package_id: string }>(
			"POST",
			`/fulfillment/202309/orders/${encodeURIComponent(orderId)}/packages`,
			{
				tracking_number: params.tracking_number,
				shipping_provider_id: params.shipping_provider_id,
			},
		);
	}
}

// ── Mapping helpers ─────────────────────────────────────────────────────────

/**
 * Map TikTok order status code to internal status.
 * TikTok statuses: 100=Unpaid, 111=On hold, 112=Partially shipped,
 * 114=Awaiting collection, 121=In transit, 122=Delivered, 130=Completed,
 * 140=Cancelled.
 */
export function mapTikTokOrderStatus(
	status: number,
):
	| "pending"
	| "confirmed"
	| "shipped"
	| "delivered"
	| "cancelled"
	| "refunded" {
	if (status === 100 || status === 111) return "pending";
	if (status === 112 || status === 114) return "confirmed";
	if (status === 121) return "shipped";
	if (status === 122 || status === 130) return "delivered";
	if (status === 140) return "cancelled";
	return "pending";
}

/**
 * Map TikTok product status code to internal status.
 * 1=Draft, 2=Pending, 3=Failed, 4=Live, 5=Seller deactivated, 6=Platform deactivated, 7=Frozen.
 */
export function mapTikTokProductStatus(
	status: number,
): "draft" | "pending" | "active" | "rejected" | "suspended" {
	if (status === 1) return "draft";
	if (status === 2) return "pending";
	if (status === 3) return "rejected";
	if (status === 4) return "active";
	if (status === 5 || status === 6 || status === 7) return "suspended";
	return "draft";
}

// ── Webhook signature verification ──────────────────────────────────────────

/**
 * Verify a TikTok Shop webhook signature.
 * TikTok signs webhook push requests using HMAC-SHA256 with the app_secret.
 * The sign string is: path + sorted query params (key+value, excluding sign
 * and access_token) + request body. The signature is a hex string sent as
 * the `sign` query parameter.
 */
export async function verifyWebhookSignature(
	path: string,
	params: Record<string, string>,
	body: string,
	appSecret: string,
): Promise<boolean> {
	const expectedSign = params.sign;
	if (!expectedSign) return false;

	// Build the sign string: exclude "sign" and "access_token" from params
	const filtered: Record<string, string> = {};
	for (const [key, value] of Object.entries(params)) {
		if (key !== "sign" && key !== "access_token") {
			filtered[key] = value;
		}
	}

	const sortedKeys = Object.keys(filtered).sort();
	let signString = path;
	for (const key of sortedKeys) {
		signString += key + filtered[key];
	}
	if (body) signString += body;

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(appSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(signString),
	);
	const computedHex = Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	// Timing-safe comparison
	if (computedHex.length !== expectedSign.length) return false;
	let mismatch = 0;
	for (let i = 0; i < computedHex.length; i++) {
		mismatch |= computedHex.charCodeAt(i) ^ expectedSign.charCodeAt(i);
	}
	return mismatch === 0;
}

/** Parse a TikTok money string (already in dollars/units). */
export function parseTikTokMoney(amount: string | undefined): number {
	if (!amount) return 0;
	const val = Number.parseFloat(amount);
	return Number.isNaN(val) ? 0 : val;
}
