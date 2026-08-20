/**
 * Etsy Open API v3 provider.
 * Makes real HTTP calls to https://openapi.etsy.com/v3/.
 * Authentication uses x-api-key header + Bearer token for shop-specific ops.
 */

// ── Etsy API types ───────────────────────────────────────────────────────────

export interface EtsyApiListing {
	listing_id: number;
	title: string;
	description: string;
	state: "active" | "draft" | "inactive" | "expired" | "sold_out";
	price: {
		amount: number;
		divisor: number;
		currency_code: string;
	};
	quantity: number;
	who_made: "i_did" | "collective" | "someone_else";
	when_made: string;
	is_supply: boolean;
	materials: string[];
	tags: string[];
	taxonomy_id: number | null;
	shipping_profile_id: number | null;
	views: number;
	num_favorers: number;
	url: string;
	creation_tsz: number;
	last_modified_tsz: number;
	ending_tsz: number;
}

export interface EtsyApiReceipt {
	receipt_id: number;
	status: "open" | "paid" | "completed" | "canceled";
	transactions: EtsyApiTransaction[];
	name: string;
	buyer_email: string | null;
	formatted_address: string;
	first_line: string;
	second_line: string | null;
	city: string;
	state: string;
	zip: string;
	country_iso: string;
	gift_message: string;
	subtotal: { amount: number; divisor: number; currency_code: string };
	total_shipping_cost: {
		amount: number;
		divisor: number;
		currency_code: string;
	};
	total_tax_cost: { amount: number; divisor: number; currency_code: string };
	total_price: { amount: number; divisor: number; currency_code: string };
	shipping_carrier: string | null;
	shipping_tracking_code: string | null;
	shipped_date: number | null;
	is_shipped: boolean;
	create_timestamp: number;
	update_timestamp: number;
}

export interface EtsyApiTransaction {
	transaction_id: number;
	listing_id: number;
	title: string;
	quantity: number;
	price: { amount: number; divisor: number; currency_code: string };
}

export interface EtsyApiReview {
	shop_id: number;
	listing_id: number;
	transaction_id: number;
	buyer_user_id: number;
	rating: number;
	review: string | null;
	create_timestamp: number;
	image_url_fullxfull: string | null;
}

export interface EtsyPaginatedResponse<T> {
	count: number;
	results: T[];
}

export interface EtsyApiErrorResponse {
	error: string;
	error_description?: string | undefined;
}

export interface CreateListingParams {
	title: string;
	description: string;
	price: number;
	quantity: number;
	who_made: "i_did" | "collective" | "someone_else";
	when_made: string;
	is_supply: boolean;
	taxonomy_id: number;
	shipping_profile_id?: number | undefined;
	materials?: string[] | undefined;
	tags?: string[] | undefined;
	state?: "active" | "draft" | undefined;
}

export interface UpdateListingParams {
	title?: string | undefined;
	description?: string | undefined;
	price?: number | undefined;
	quantity?: number | undefined;
	state?: "active" | "draft" | "inactive" | undefined;
	materials?: string[] | undefined;
	tags?: string[] | undefined;
}

// ── Provider class ───────────────────────────────────────────────────────────

export class EtsyProvider {
	private readonly apiKey: string;
	private readonly shopId: string;
	private readonly accessToken: string;
	private readonly baseUrl = "https://openapi.etsy.com/v3";

	constructor(apiKey: string, shopId: string, accessToken: string) {
		this.apiKey = apiKey;
		this.shopId = shopId;
		this.accessToken = accessToken;
	}

	private async request<T>(
		method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				"x-api-key": this.apiKey,
				Authorization: `Bearer ${this.accessToken}`,
				"Content-Type": "application/json",
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		const json = (await res.json()) as T | EtsyApiErrorResponse;
		if (!res.ok) {
			const err = json as EtsyApiErrorResponse;
			throw new Error(
				`Etsy API error: ${err.error_description ?? err.error ?? `HTTP ${res.status}`}`,
			);
		}
		return json as T;
	}

	/**
	 * Verify that the API key, shop ID, and access token are valid by
	 * fetching listings with limit=1.
	 */
	async verifyConnection(): Promise<
		{ ok: true; shopId: string } | { ok: false; error: string }
	> {
		try {
			await this.getListings({ limit: 1 });
			return { ok: true, shopId: this.shopId };
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}

	/**
	 * Get all active listings for the shop.
	 * GET /application/shops/{shop_id}/listings
	 */
	async getListings(params?: {
		state?: string | undefined;
		limit?: number | undefined;
		offset?: number | undefined;
	}): Promise<EtsyPaginatedResponse<EtsyApiListing>> {
		const query = new URLSearchParams();
		if (params?.state) query.set("state", params.state);
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.offset) query.set("offset", String(params.offset));
		const qs = query.toString();
		return this.request<EtsyPaginatedResponse<EtsyApiListing>>(
			"GET",
			`/application/shops/${this.shopId}/listings${qs ? `?${qs}` : ""}`,
		);
	}

	/**
	 * Get a single listing by ID.
	 * GET /application/listings/{listing_id}
	 */
	async getListing(listingId: number): Promise<EtsyApiListing> {
		return this.request<EtsyApiListing>(
			"GET",
			`/application/listings/${listingId}`,
		);
	}

	/**
	 * Create a new draft listing.
	 * POST /application/shops/{shop_id}/listings
	 */
	async createListing(params: CreateListingParams): Promise<EtsyApiListing> {
		return this.request<EtsyApiListing>(
			"POST",
			`/application/shops/${this.shopId}/listings`,
			{
				title: params.title,
				description: params.description,
				price: params.price,
				quantity: params.quantity,
				who_made: params.who_made,
				when_made: params.when_made,
				is_supply: params.is_supply,
				taxonomy_id: params.taxonomy_id,
				...(params.shipping_profile_id !== undefined
					? { shipping_profile_id: params.shipping_profile_id }
					: {}),
				...(params.materials ? { materials: params.materials } : {}),
				...(params.tags ? { tags: params.tags } : {}),
				...(params.state ? { state: params.state } : {}),
			},
		);
	}

	/**
	 * Update an existing listing.
	 * PATCH /application/shops/{shop_id}/listings/{listing_id}
	 */
	async updateListing(
		listingId: number,
		params: UpdateListingParams,
	): Promise<EtsyApiListing> {
		const body: Record<string, unknown> = {};
		if (params.title !== undefined) body.title = params.title;
		if (params.description !== undefined) body.description = params.description;
		if (params.price !== undefined) body.price = params.price;
		if (params.quantity !== undefined) body.quantity = params.quantity;
		if (params.state !== undefined) body.state = params.state;
		if (params.materials !== undefined) body.materials = params.materials;
		if (params.tags !== undefined) body.tags = params.tags;

		return this.request<EtsyApiListing>(
			"PATCH",
			`/application/shops/${this.shopId}/listings/${listingId}`,
			body,
		);
	}

	/**
	 * Delete a listing.
	 * DELETE /application/shops/{shop_id}/listings/{listing_id}
	 */
	async deleteListing(listingId: number): Promise<void> {
		await this.request<void>(
			"DELETE",
			`/application/shops/${this.shopId}/listings/${listingId}`,
		);
	}

	/**
	 * Get shop receipts (orders).
	 * GET /application/shops/{shop_id}/receipts
	 */
	async getReceipts(params?: {
		was_shipped?: boolean | undefined;
		limit?: number | undefined;
		offset?: number | undefined;
	}): Promise<EtsyPaginatedResponse<EtsyApiReceipt>> {
		const query = new URLSearchParams();
		if (params?.was_shipped !== undefined)
			query.set("was_shipped", String(params.was_shipped));
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.offset) query.set("offset", String(params.offset));
		const qs = query.toString();
		return this.request<EtsyPaginatedResponse<EtsyApiReceipt>>(
			"GET",
			`/application/shops/${this.shopId}/receipts${qs ? `?${qs}` : ""}`,
		);
	}

	/**
	 * Get a single receipt by ID.
	 * GET /application/shops/{shop_id}/receipts/{receipt_id}
	 */
	async getReceipt(receiptId: number): Promise<EtsyApiReceipt> {
		return this.request<EtsyApiReceipt>(
			"GET",
			`/application/shops/${this.shopId}/receipts/${receiptId}`,
		);
	}

	/**
	 * Create a shipment (add tracking) for a receipt.
	 * POST /application/shops/{shop_id}/receipts/{receipt_id}/tracking
	 */
	async createReceiptShipment(
		receiptId: number,
		trackingCode: string,
		carrierName: string,
	): Promise<EtsyApiReceipt> {
		return this.request<EtsyApiReceipt>(
			"POST",
			`/application/shops/${this.shopId}/receipts/${receiptId}/tracking`,
			{
				tracking_code: trackingCode,
				carrier_name: carrierName,
			},
		);
	}

	/**
	 * Get shop reviews.
	 * GET /application/shops/{shop_id}/reviews
	 */
	async getReviews(params?: {
		limit?: number | undefined;
		offset?: number | undefined;
	}): Promise<EtsyPaginatedResponse<EtsyApiReview>> {
		const query = new URLSearchParams();
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.offset) query.set("offset", String(params.offset));
		const qs = query.toString();
		return this.request<EtsyPaginatedResponse<EtsyApiReview>>(
			"GET",
			`/application/shops/${this.shopId}/reviews${qs ? `?${qs}` : ""}`,
		);
	}
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

/** Convert Etsy API listing state to internal status */
export function mapEtsyStateToStatus(
	state: EtsyApiListing["state"],
): "active" | "draft" | "expired" | "inactive" | "sold-out" {
	switch (state) {
		case "active":
			return "active";
		case "draft":
			return "draft";
		case "expired":
			return "expired";
		case "inactive":
			return "inactive";
		case "sold_out":
			return "sold-out";
		default:
			return "inactive";
	}
}

/** Convert internal who_made_it to Etsy API format */
export function mapWhoMadeToApi(
	who: "i-did" | "collective" | "someone-else",
): "i_did" | "collective" | "someone_else" {
	switch (who) {
		case "i-did":
			return "i_did";
		case "someone-else":
			return "someone_else";
		default:
			return who;
	}
}

/** Convert Etsy API who_made to internal format */
export function mapWhoMadeFromApi(
	who: "i_did" | "collective" | "someone_else",
): "i-did" | "collective" | "someone-else" {
	switch (who) {
		case "i_did":
			return "i-did";
		case "someone_else":
			return "someone-else";
		default:
			return who;
	}
}

/** Convert Etsy money object to a decimal number */
export function etsyMoney(money: { amount: number; divisor: number }): number {
	return money.amount / money.divisor;
}

// ── Webhook signature verification ──────────────────────────────────────────

/**
 * Verify an Etsy webhook signature.
 * Uses HMAC-SHA256 with a shared webhook secret.
 * The signature is sent in the X-Etsy-Signature header as a hex string.
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
