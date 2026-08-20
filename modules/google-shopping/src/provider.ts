/**
 * Google Content API for Shopping (Merchant Center) provider.
 * Makes real HTTP calls to https://shoppingcontent.googleapis.com/content/v2.1/.
 * Authentication uses API key query parameter.
 */

// ── Google Content API types ─────────────────────────────────────────────────

export interface GooglePrice {
	value: string;
	currency: string;
}

export interface GoogleProduct {
	id?: string | undefined;
	offerId: string;
	title: string;
	description?: string | undefined;
	link: string;
	imageLink: string;
	contentLanguage: string;
	targetCountry: string;
	channel: "online";
	availability: "in_stock" | "out_of_stock" | "preorder";
	condition: "new" | "refurbished" | "used";
	price: GooglePrice;
	salePrice?: GooglePrice | undefined;
	gtin?: string | undefined;
	mpn?: string | undefined;
	brand?: string | undefined;
	googleProductCategory?: string | undefined;
}

export interface GoogleProductStatus {
	productId: string;
	title: string;
	destinationStatuses: Array<{
		destination: string;
		status: "approved" | "disapproved" | "pending";
	}>;
	itemLevelIssues: Array<{
		code: string;
		servability: string;
		resolution: string;
		attributeName?: string | undefined;
		destination?: string | undefined;
		description?: string | undefined;
		detail?: string | undefined;
		documentation?: string | undefined;
	}>;
}

export interface GoogleProductsListResponse {
	kind: "content#productsListResponse";
	resources?: GoogleProduct[] | undefined;
	nextPageToken?: string | undefined;
}

export interface GoogleProductStatusesListResponse {
	kind: "content#productstatusesListResponse";
	resources?: GoogleProductStatus[] | undefined;
	nextPageToken?: string | undefined;
}

export interface GoogleApiErrorResponse {
	error: {
		code: number;
		message: string;
		status: string;
		errors?: Array<{ message: string; domain: string; reason: string }>;
	};
}

// ── Provider class ───────────────────────────────────────────────────────────

export class GoogleShoppingProvider {
	private readonly merchantId: string;
	private readonly apiKey: string;
	private readonly baseUrl =
		"https://shoppingcontent.googleapis.com/content/v2.1";

	constructor(merchantId: string, apiKey: string) {
		this.merchantId = merchantId;
		this.apiKey = apiKey;
	}

	private async request<T>(
		method: "GET" | "POST" | "PUT" | "DELETE",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const sep = path.includes("?") ? "&" : "?";
		const url = `${this.baseUrl}/${this.merchantId}${path}${sep}key=${encodeURIComponent(this.apiKey)}`;

		const res = await fetch(url, {
			method,
			headers: { "Content-Type": "application/json" },
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		if (method === "DELETE" && res.ok) {
			return undefined as T;
		}

		const json = (await res.json()) as T | GoogleApiErrorResponse;
		if (!res.ok) {
			const err = json as GoogleApiErrorResponse;
			throw new Error(
				`Google Shopping API error: ${err.error?.message ?? `HTTP ${res.status}`}`,
			);
		}
		return json as T;
	}

	/**
	 * Verify that the merchant ID and API key are valid by listing products.
	 */
	async verifyConnection(): Promise<
		{ ok: true; merchantId: string } | { ok: false; error: string }
	> {
		try {
			await this.listProducts({ maxResults: 1 });
			return { ok: true, merchantId: this.merchantId };
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}

	/**
	 * Insert or update a product in Merchant Center.
	 * POST /{merchantId}/products
	 */
	async insertProduct(product: GoogleProduct): Promise<GoogleProduct> {
		return this.request<GoogleProduct>(
			"POST",
			"/products",
			product as unknown as Record<string, unknown>,
		);
	}

	/**
	 * Get a product by ID.
	 * GET /{merchantId}/products/{productId}
	 */
	async getProduct(productId: string): Promise<GoogleProduct> {
		return this.request<GoogleProduct>(
			"GET",
			`/products/${encodeURIComponent(productId)}`,
		);
	}

	/**
	 * List all products.
	 * GET /{merchantId}/products
	 */
	async listProducts(params?: {
		maxResults?: number | undefined;
		pageToken?: string | undefined;
	}): Promise<GoogleProductsListResponse> {
		const query = new URLSearchParams();
		if (params?.maxResults) query.set("maxResults", String(params.maxResults));
		if (params?.pageToken) query.set("pageToken", params.pageToken);
		const qs = query.toString();
		return this.request<GoogleProductsListResponse>(
			"GET",
			`/products${qs ? `?${qs}` : ""}`,
		);
	}

	/**
	 * Delete a product.
	 * DELETE /{merchantId}/products/{productId}
	 */
	async deleteProduct(productId: string): Promise<void> {
		await this.request<void>(
			"DELETE",
			`/products/${encodeURIComponent(productId)}`,
		);
	}

	/**
	 * List product statuses (approval status, issues).
	 * GET /{merchantId}/productstatuses
	 */
	async listProductStatuses(params?: {
		maxResults?: number | undefined;
		pageToken?: string | undefined;
	}): Promise<GoogleProductStatusesListResponse> {
		const query = new URLSearchParams();
		if (params?.maxResults) query.set("maxResults", String(params.maxResults));
		if (params?.pageToken) query.set("pageToken", params.pageToken);
		const qs = query.toString();
		return this.request<GoogleProductStatusesListResponse>(
			"GET",
			`/productstatuses${qs ? `?${qs}` : ""}`,
		);
	}
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

/** Map Google availability string to internal format */
export function mapAvailabilityFromGoogle(
	availability: GoogleProduct["availability"],
): "in-stock" | "out-of-stock" | "preorder" {
	switch (availability) {
		case "in_stock":
			return "in-stock";
		case "out_of_stock":
			return "out-of-stock";
		case "preorder":
			return "preorder";
		default:
			return "in-stock";
	}
}

/** Map internal availability to Google format */
export function mapAvailabilityToGoogle(
	availability: "in-stock" | "out-of-stock" | "preorder",
): GoogleProduct["availability"] {
	switch (availability) {
		case "in-stock":
			return "in_stock";
		case "out-of-stock":
			return "out_of_stock";
		case "preorder":
			return "preorder";
		default:
			return "in_stock";
	}
}

/** Map Google product status to internal feed item status */
export function mapProductStatusToInternal(
	statuses: GoogleProductStatus["destinationStatuses"],
): "active" | "pending" | "disapproved" {
	if (statuses.some((s) => s.status === "disapproved")) return "disapproved";
	if (statuses.every((s) => s.status === "approved")) return "active";
	return "pending";
}

// ── Webhook signature verification ──────────────────────────────────────────

/**
 * Verify a Google Shopping webhook signature.
 * Uses HMAC-SHA256 with a shared webhook secret.
 * The signature is sent in the X-Goog-Signature header as a hex string.
 */
export async function verifyWebhookSignature(
	payload: string,
	signature: string,
	webhookSecret: string,
): Promise<boolean> {
	if (!signature) return false;

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(webhookSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const computed = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(payload),
	);
	const computedHex = Array.from(new Uint8Array(computed))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	// Timing-safe comparison
	if (computedHex.length !== signature.length) return false;
	let mismatch = 0;
	for (let i = 0; i < computedHex.length; i++) {
		mismatch |= computedHex.charCodeAt(i) ^ signature.charCodeAt(i);
	}
	return mismatch === 0;
}
