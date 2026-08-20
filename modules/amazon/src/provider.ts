/**
 * Amazon Selling Partner API provider.
 * Makes real HTTP calls to the Amazon SP-API.
 * Authentication uses Login with Amazon (LWA) OAuth2 refresh tokens.
 */

// ── SP-API response types ───────────────────────────────────────────────────

export interface SpApiListingSummary {
	marketplaceId: string;
	asin: string;
	productType: string;
	conditionType?: string | undefined;
	status: string[];
	itemName: string;
	createdDate: string;
	lastUpdatedDate: string;
	mainImage?: { link: string; height: number; width: number } | undefined;
}

export interface SpApiOffer {
	marketplaceId: string;
	offerType: string;
	price: { currencyCode: string; amount: string };
}

export interface SpApiFulfillmentAvailability {
	fulfillmentChannelCode: string;
	quantity: number;
}

export interface SpApiIssue {
	code: string;
	message: string;
	severity: "ERROR" | "WARNING";
	attributeNames?: string[] | undefined;
}

export interface SpApiListingItem {
	sku: string;
	summaries?: SpApiListingSummary[] | undefined;
	offers?: SpApiOffer[] | undefined;
	fulfillmentAvailability?: SpApiFulfillmentAvailability[] | undefined;
	issues?: SpApiIssue[] | undefined;
}

export interface SpApiSubmissionResponse {
	sku: string;
	status: "ACCEPTED" | "INVALID" | "VALID";
	submissionId: string;
	identifiers?: { marketplaceId: string; asin: string }[] | undefined;
	issues?: SpApiIssue[] | undefined;
}

export interface SpApiSearchResult {
	numberOfResults: number;
	pagination: {
		nextToken?: string | undefined;
		previousToken?: string | undefined;
	};
	items: SpApiListingItem[];
}

export interface SpApiOrder {
	AmazonOrderId: string;
	PurchaseDate: string;
	LastUpdateDate: string;
	OrderStatus: string;
	FulfillmentChannel: string;
	NumberOfItemsShipped: number;
	NumberOfItemsUnshipped: number;
	OrderTotal?: { CurrencyCode: string; Amount: string } | undefined;
	ShippingAddress?:
		| {
				Name?: string | undefined;
				AddressLine1?: string | undefined;
				AddressLine2?: string | undefined;
				City?: string | undefined;
				StateOrRegion?: string | undefined;
				PostalCode?: string | undefined;
				CountryCode?: string | undefined;
		  }
		| undefined;
	BuyerInfo?: { BuyerName?: string | undefined } | undefined;
	IsBusinessOrder: boolean;
	IsPrime: boolean;
}

export interface SpApiOrderItem {
	ASIN: string;
	OrderItemId: string;
	SellerSKU: string;
	Title: string;
	QuantityOrdered: number;
	QuantityShipped: number;
	ItemPrice?: { CurrencyCode: string; Amount: string } | undefined;
	ItemTax?: { CurrencyCode: string; Amount: string } | undefined;
	ShippingPrice?: { CurrencyCode: string; Amount: string } | undefined;
}

export interface SpApiErrorResponse {
	errors: { code: string; message: string; details?: string | undefined }[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const REGIONAL_ENDPOINTS: Record<string, string> = {
	NA: "https://sellingpartnerapi-na.amazon.com",
	EU: "https://sellingpartnerapi-eu.amazon.com",
	FE: "https://sellingpartnerapi-fe.amazon.com",
};

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

// ── Provider class ──────────────────────────────────────────────────────────

export interface AmazonProviderConfig {
	sellerId: string;
	marketplaceId: string;
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	region?: string | undefined;
}

export class AmazonProvider {
	private readonly sellerId: string;
	private readonly marketplaceId: string;
	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly refreshToken: string;
	private readonly baseUrl: string;

	private accessToken: string | null = null;
	private tokenExpiresAt = 0;

	constructor(config: AmazonProviderConfig) {
		this.sellerId = config.sellerId;
		this.marketplaceId = config.marketplaceId;
		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;
		this.refreshToken = config.refreshToken;
		this.baseUrl =
			REGIONAL_ENDPOINTS[config.region ?? "NA"] ?? REGIONAL_ENDPOINTS.NA;
	}

	/** Obtain a fresh LWA access token, caching until near expiry. */
	private async getAccessToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.tokenExpiresAt) {
			return this.accessToken;
		}

		const res = await fetch(LWA_TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: this.refreshToken,
				client_id: this.clientId,
				client_secret: this.clientSecret,
			}).toString(),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(
				`Amazon LWA token error: HTTP ${res.status} ${text}`.trim(),
			);
		}

		const data = (await res.json()) as {
			access_token: string;
			expires_in: number;
		};
		this.accessToken = data.access_token;
		// Expire 60s early to avoid edge cases
		this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
		return this.accessToken;
	}

	/** Make an authenticated request to the SP-API. */
	private async request<T>(
		method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const token = await this.getAccessToken();
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				"x-amz-access-token": token,
				"Content-Type": "application/json",
				"user-agent": "86d-Commerce/1.0 (Language=TypeScript)",
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		if (!res.ok) {
			const errBody = (await res
				.json()
				.catch(() => null)) as SpApiErrorResponse | null;
			const msg = errBody?.errors?.[0]?.message ?? `HTTP ${res.status}`;
			throw new Error(`Amazon SP-API error: ${msg}`);
		}

		if (res.status === 204) return undefined as T;
		return (await res.json()) as T;
	}

	// ── Connection verification ──────────────────────────────────────────

	/**
	 * Verify that the credentials are valid by searching listings with
	 * pageSize=1.
	 */
	async verifyConnection(): Promise<
		{ ok: true; sellerId: string } | { ok: false; error: string }
	> {
		try {
			await this.searchListings({ pageSize: 1 });
			return { ok: true, sellerId: this.sellerId };
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}

	// ── Listings Items API ────────────────────────────────────────────────

	/**
	 * Search all listings for this seller.
	 * GET /listings/2021-08-01/items/{sellerId}
	 */
	async searchListings(params?: {
		pageSize?: number | undefined;
		pageToken?: string | undefined;
	}): Promise<SpApiSearchResult> {
		const query = new URLSearchParams();
		query.set("marketplaceIds", this.marketplaceId);
		query.set(
			"includedData",
			"summaries,offers,fulfillmentAvailability,issues",
		);
		if (params?.pageSize) query.set("pageSize", String(params.pageSize));
		if (params?.pageToken) query.set("pageToken", params.pageToken);

		return this.request<SpApiSearchResult>(
			"GET",
			`/listings/2021-08-01/items/${this.sellerId}?${query.toString()}`,
		);
	}

	/**
	 * Get a specific listing by SKU.
	 * GET /listings/2021-08-01/items/{sellerId}/{sku}
	 */
	async getListing(sku: string): Promise<SpApiListingItem> {
		const query = new URLSearchParams();
		query.set("marketplaceIds", this.marketplaceId);
		query.set(
			"includedData",
			"summaries,offers,fulfillmentAvailability,issues",
		);

		return this.request<SpApiListingItem>(
			"GET",
			`/listings/2021-08-01/items/${this.sellerId}/${encodeURIComponent(sku)}?${query.toString()}`,
		);
	}

	/**
	 * Create or fully replace a listing.
	 * PUT /listings/2021-08-01/items/{sellerId}/{sku}
	 */
	async putListing(
		sku: string,
		productType: string,
		attributes: Record<string, unknown[]>,
	): Promise<SpApiSubmissionResponse> {
		const query = new URLSearchParams();
		query.set("marketplaceIds", this.marketplaceId);
		query.set("includedData", "issues");

		return this.request<SpApiSubmissionResponse>(
			"PUT",
			`/listings/2021-08-01/items/${this.sellerId}/${encodeURIComponent(sku)}?${query.toString()}`,
			{ productType, requirements: "LISTING", attributes },
		);
	}

	/**
	 * Partially update a listing using JSON Patch operations.
	 * PATCH /listings/2021-08-01/items/{sellerId}/{sku}
	 */
	async patchListing(
		sku: string,
		productType: string,
		patches: {
			op: "add" | "replace" | "delete";
			path: string;
			value?: unknown[];
		}[],
	): Promise<SpApiSubmissionResponse> {
		const query = new URLSearchParams();
		query.set("marketplaceIds", this.marketplaceId);
		query.set("includedData", "issues");

		return this.request<SpApiSubmissionResponse>(
			"PATCH",
			`/listings/2021-08-01/items/${this.sellerId}/${encodeURIComponent(sku)}?${query.toString()}`,
			{ productType, patches },
		);
	}

	/**
	 * Delete a listing.
	 * DELETE /listings/2021-08-01/items/{sellerId}/{sku}
	 */
	async deleteListing(sku: string): Promise<SpApiSubmissionResponse> {
		const query = new URLSearchParams();
		query.set("marketplaceIds", this.marketplaceId);

		return this.request<SpApiSubmissionResponse>(
			"DELETE",
			`/listings/2021-08-01/items/${this.sellerId}/${encodeURIComponent(sku)}?${query.toString()}`,
		);
	}

	// ── Orders API ────────────────────────────────────────────────────────

	/**
	 * Get orders created or updated within a time range.
	 * GET /orders/v0/orders
	 */
	async getOrders(params: {
		createdAfter?: string | undefined;
		lastUpdatedAfter?: string | undefined;
		orderStatuses?: string[] | undefined;
		maxResultsPerPage?: number | undefined;
		nextToken?: string | undefined;
	}): Promise<{ Orders: SpApiOrder[]; NextToken?: string | undefined }> {
		const query = new URLSearchParams();
		query.set("MarketplaceIds", this.marketplaceId);
		if (params.createdAfter) query.set("CreatedAfter", params.createdAfter);
		if (params.lastUpdatedAfter)
			query.set("LastUpdatedAfter", params.lastUpdatedAfter);
		if (params.orderStatuses)
			query.set("OrderStatuses", params.orderStatuses.join(","));
		if (params.maxResultsPerPage)
			query.set("MaxResultsPerPage", String(params.maxResultsPerPage));
		if (params.nextToken) query.set("NextToken", params.nextToken);

		const result = await this.request<{
			payload: {
				Orders: SpApiOrder[];
				NextToken?: string | undefined;
			};
		}>("GET", `/orders/v0/orders?${query.toString()}`);

		return result.payload;
	}

	/**
	 * Get a specific order by Amazon order ID.
	 * GET /orders/v0/orders/{orderId}
	 */
	async getOrder(orderId: string): Promise<SpApiOrder> {
		const result = await this.request<{
			payload: SpApiOrder;
		}>("GET", `/orders/v0/orders/${encodeURIComponent(orderId)}`);
		return result.payload;
	}

	/**
	 * Get items for a specific order.
	 * GET /orders/v0/orders/{orderId}/orderItems
	 */
	async getOrderItems(orderId: string): Promise<SpApiOrderItem[]> {
		const result = await this.request<{
			payload: {
				AmazonOrderId: string;
				OrderItems: SpApiOrderItem[];
			};
		}>("GET", `/orders/v0/orders/${encodeURIComponent(orderId)}/orderItems`);
		return result.payload.OrderItems;
	}

	/**
	 * Confirm shipment for an order.
	 * POST /orders/v0/orders/{orderId}/shipment
	 */
	async confirmShipment(
		orderId: string,
		packageDetail: {
			trackingNumber: string;
			carrierCode: string;
		},
	): Promise<void> {
		await this.request<void>(
			"POST",
			`/orders/v0/orders/${encodeURIComponent(orderId)}/shipment`,
			{
				marketplaceId: this.marketplaceId,
				shipmentStatus: "ReadyForPickup",
				packageDetail: {
					packageReferenceId: `pkg-${orderId}`,
					carrierCode: packageDetail.carrierCode,
					trackingNumber: packageDetail.trackingNumber,
				},
			},
		);
	}
}

// ── Mapping helpers ─────────────────────────────────────────────────────────

/** Map SP-API order status to internal status */
export function mapOrderStatus(
	spStatus: string,
): "pending" | "unshipped" | "shipped" | "cancelled" | "returned" {
	switch (spStatus) {
		case "Pending":
		case "PendingAvailability":
			return "pending";
		case "Unshipped":
		case "PartiallyShipped":
			return "unshipped";
		case "Shipped":
			return "shipped";
		case "Canceled":
			return "cancelled";
		case "Unfulfillable":
			return "returned";
		default:
			return "pending";
	}
}

/** Map SP-API fulfillment channel to internal channel */
export function mapFulfillmentChannel(channel: string): "FBA" | "FBM" {
	return channel === "AFN" ? "FBA" : "FBM";
}

/** Parse SP-API money string to number */
export function parseSpApiMoney(money: { Amount: string } | undefined): number {
	if (!money?.Amount) return 0;
	return Number.parseFloat(money.Amount) || 0;
}
