/**
 * eBay REST API provider.
 * Makes real HTTP calls to the eBay Sell Inventory and Fulfillment APIs.
 * Authentication uses eBay OAuth 2.0 refresh tokens.
 */

// ── eBay API response types ──────────────────────────────────────────────────

export interface EbayApiOffer {
	offerId: string;
	sku: string;
	marketplaceId: string;
	format: "FIXED_PRICE" | "AUCTION";
	availableQuantity: number;
	categoryId?: string | undefined;
	listingDescription?: string | undefined;
	pricingSummary?: {
		price?: { value: string; currency: string } | undefined;
		auctionStartPrice?: { value: string; currency: string } | undefined;
		auctionReservePrice?: { value: string; currency: string } | undefined;
	};
	status?: "PUBLISHED" | "UNPUBLISHED" | "ENDED" | undefined;
	listing?: { listingId: string } | undefined;
}

export interface EbayApiOfferResponse {
	offerId: string;
	warnings?: EbayApiWarning[] | undefined;
}

export interface EbayApiPublishResponse {
	listingId: string;
	warnings?: EbayApiWarning[] | undefined;
}

export interface EbayApiWithdrawResponse {
	listingId: string;
	warnings?: EbayApiWarning[] | undefined;
}

export interface EbayApiInventoryItem {
	sku: string;
	locale?: string | undefined;
	product: {
		title: string;
		description?: string | undefined;
		imageUrls?: string[] | undefined;
		aspects?: Record<string, string[]> | undefined;
	};
	condition:
		| "NEW"
		| "LIKE_NEW"
		| "USED_VERY_GOOD"
		| "USED_GOOD"
		| "USED_ACCEPTABLE"
		| "FOR_PARTS_OR_NOT_WORKING";
	availability: {
		shipToLocationAvailability: {
			quantity: number;
		};
	};
}

export interface EbayApiInventoryItems {
	inventoryItems: EbayApiInventoryItem[];
	total: number;
	size: number;
	href: string;
	next?: string | undefined;
}

export interface EbayApiOrder {
	orderId: string;
	creationDate: string;
	lastModifiedDate: string;
	orderFulfillmentStatus: "NOT_STARTED" | "IN_PROGRESS" | "FULFILLED";
	orderPaymentStatus: "PENDING" | "FAILED" | "FULLY_REFUNDED" | "PAID";
	pricingSummary: {
		priceSubtotal: { value: string; currency: string };
		deliveryCost?: { value: string; currency: string } | undefined;
		total: { value: string; currency: string };
	};
	buyer: {
		username: string;
		buyerRegistrationAddress?: {
			fullName?: string | undefined;
		};
	};
	fulfillmentStartInstructions?: {
		shippingStep?: {
			shipTo?: {
				fullName?: string | undefined;
				contactAddress?: {
					addressLine1?: string | undefined;
					addressLine2?: string | undefined;
					city?: string | undefined;
					stateOrProvince?: string | undefined;
					postalCode?: string | undefined;
					countryCode?: string | undefined;
				};
			};
		};
	}[];
	lineItems: EbayApiLineItem[];
	cancelStatus?: {
		cancelState: "NONE_REQUESTED" | "CANCEL_REQUESTED" | "CANCEL_CLOSED";
	};
}

export interface EbayApiLineItem {
	lineItemId: string;
	legacyItemId: string;
	title: string;
	quantity: number;
	lineItemCost: { value: string; currency: string };
	sku?: string | undefined;
	lineItemFulfillmentStatus: "NOT_STARTED" | "IN_PROGRESS" | "FULFILLED";
}

export interface EbayApiOrdersResponse {
	orders: EbayApiOrder[];
	total: number;
	offset: number;
	limit: number;
	next?: string | undefined;
}

export interface EbayApiWarning {
	category: string;
	domain: string;
	errorId: number;
	message: string;
	longMessage?: string | undefined;
}

export interface EbayApiErrorResponse {
	errors?: { errorId: number; message: string; longMessage?: string }[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_SANDBOX_TOKEN_URL =
	"https://api.sandbox.ebay.com/identity/v1/oauth2/token";

const EBAY_API_BASE = "https://api.ebay.com";
const EBAY_SANDBOX_API_BASE = "https://api.sandbox.ebay.com";

// ── Condition mapping ────────────────────────────────────────────────────────

type LocalCondition =
	| "new"
	| "like-new"
	| "very-good"
	| "good"
	| "acceptable"
	| "for-parts";

const CONDITION_MAP: Record<LocalCondition, EbayApiInventoryItem["condition"]> =
	{
		new: "NEW",
		"like-new": "LIKE_NEW",
		"very-good": "USED_VERY_GOOD",
		good: "USED_GOOD",
		acceptable: "USED_ACCEPTABLE",
		"for-parts": "FOR_PARTS_OR_NOT_WORKING",
	};

const REVERSE_CONDITION_MAP: Record<string, LocalCondition> = {
	NEW: "new",
	LIKE_NEW: "like-new",
	USED_VERY_GOOD: "very-good",
	USED_GOOD: "good",
	USED_ACCEPTABLE: "acceptable",
	FOR_PARTS_OR_NOT_WORKING: "for-parts",
};

// ── Provider class ───────────────────────────────────────────────────────────

export interface EbayProviderConfig {
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	siteId?: string | undefined;
	currency?: string | undefined;
	sandbox?: boolean | undefined;
}

export class EbayProvider {
	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly refreshToken: string;
	private readonly siteId: string;
	private readonly currency: string;
	private readonly baseUrl: string;
	private readonly tokenUrl: string;
	private readonly sandbox: boolean;

	private accessToken: string | null = null;
	private tokenExpiresAt = 0;

	constructor(config: EbayProviderConfig) {
		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;
		this.refreshToken = config.refreshToken;
		this.siteId = config.siteId ?? "EBAY_US";
		this.currency = config.currency ?? "USD";
		this.sandbox = Boolean(config.sandbox);
		this.baseUrl = config.sandbox ? EBAY_SANDBOX_API_BASE : EBAY_API_BASE;
		this.tokenUrl = config.sandbox ? EBAY_SANDBOX_TOKEN_URL : EBAY_TOKEN_URL;
	}

	/**
	 * Verify that the configured clientId, clientSecret, and refreshToken can
	 * be exchanged for an access token. Returns the token scopes eBay granted
	 * so admins can detect missing permissions (e.g. sell.fulfillment).
	 */
	async verifyConnection(): Promise<
		| { ok: true; mode: "sandbox" | "live"; scopes: string[] }
		| { ok: false; error: string }
	> {
		try {
			const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
			const res = await fetch(this.tokenUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization: `Basic ${credentials}`,
				},
				body: new URLSearchParams({
					grant_type: "refresh_token",
					refresh_token: this.refreshToken,
					scope:
						"https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.fulfillment https://api.ebay.com/oauth/api_scope/sell.account",
				}).toString(),
			});

			if (!res.ok) {
				const text = await res.text().catch(() => "");
				let message = `HTTP ${res.status}`;
				try {
					const parsed = JSON.parse(text) as {
						error?: string;
						error_description?: string;
					};
					if (parsed.error_description) {
						message = parsed.error_description;
					} else if (parsed.error) {
						message = parsed.error;
					}
				} catch {
					if (text) message = text.slice(0, 200);
				}
				return { ok: false, error: message };
			}

			const data = (await res.json()) as {
				access_token: string;
				expires_in: number;
				token_type: string;
				refresh_token_expires_in?: number;
				scope?: string;
			};

			this.accessToken = data.access_token;
			this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

			return {
				ok: true,
				mode: this.sandbox ? "sandbox" : "live",
				scopes: data.scope ? data.scope.split(" ").filter(Boolean) : [],
			};
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}

	/** Obtain a fresh OAuth2 access token, caching until near expiry. */
	private async getAccessToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.tokenExpiresAt) {
			return this.accessToken;
		}

		const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
		const res = await fetch(this.tokenUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${credentials}`,
			},
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: this.refreshToken,
				scope:
					"https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.fulfillment https://api.ebay.com/oauth/api_scope/sell.account",
			}).toString(),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(
				`eBay OAuth token error: HTTP ${res.status} ${text}`.trim(),
			);
		}

		const data = (await res.json()) as {
			access_token: string;
			expires_in: number;
			token_type: string;
		};
		this.accessToken = data.access_token;
		this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
		return this.accessToken;
	}

	/** Make an authenticated request to the eBay REST API. */
	private async request<T>(
		method: "GET" | "POST" | "PUT" | "DELETE",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const token = await this.getAccessToken();
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				"Content-Language": "en-US",
				"X-EBAY-C-MARKETPLACE-ID": this.siteId,
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		if (!res.ok) {
			const errBody = (await res
				.json()
				.catch(() => null)) as EbayApiErrorResponse | null;
			const msg = errBody?.errors?.[0]?.message ?? `HTTP ${res.status}`;
			throw new Error(`eBay API error: ${msg}`);
		}

		if (res.status === 204) return undefined as T;

		const text = await res.text();
		if (!text) return undefined as T;
		return JSON.parse(text) as T;
	}

	// ── Inventory API ────────────────────────────────────────────────────

	/** Create or replace an inventory item by SKU. */
	async createOrUpdateInventoryItem(
		sku: string,
		item: {
			title: string;
			description?: string | undefined;
			condition: LocalCondition;
			quantity: number;
			imageUrls?: string[] | undefined;
		},
	): Promise<void> {
		await this.request<void>(
			"PUT",
			`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
			{
				product: {
					title: item.title,
					...(item.description ? { description: item.description } : {}),
					...(item.imageUrls?.length ? { imageUrls: item.imageUrls } : {}),
				},
				condition: CONDITION_MAP[item.condition] ?? "NEW",
				availability: {
					shipToLocationAvailability: {
						quantity: item.quantity,
					},
				},
			},
		);
	}

	/** Get an inventory item by SKU. */
	async getInventoryItem(sku: string): Promise<EbayApiInventoryItem | null> {
		try {
			return await this.request<EbayApiInventoryItem>(
				"GET",
				`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
			);
		} catch (err) {
			if (err instanceof Error && err.message.includes("HTTP 404")) {
				return null;
			}
			throw err;
		}
	}

	/** Delete an inventory item by SKU. */
	async deleteInventoryItem(sku: string): Promise<void> {
		await this.request<void>(
			"DELETE",
			`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
		);
	}

	// ── Offer API ────────────────────────────────────────────────────────

	/** Create an offer for a SKU. */
	async createOffer(params: {
		sku: string;
		price: number;
		quantity: number;
		format: "fixed-price" | "auction";
		categoryId?: string | undefined;
		auctionStartPrice?: number | undefined;
		description?: string | undefined;
	}): Promise<EbayApiOfferResponse> {
		const formatMap = {
			"fixed-price": "FIXED_PRICE",
			auction: "AUCTION",
		} as const;

		return this.request<EbayApiOfferResponse>(
			"POST",
			"/sell/inventory/v1/offer",
			{
				sku: params.sku,
				marketplaceId: this.siteId,
				format: formatMap[params.format],
				availableQuantity: params.quantity,
				...(params.categoryId ? { categoryId: params.categoryId } : {}),
				...(params.description
					? { listingDescription: params.description }
					: {}),
				pricingSummary: {
					price: {
						value: params.price.toFixed(2),
						currency: this.currency,
					},
					...(params.format === "auction" && params.auctionStartPrice
						? {
								auctionStartPrice: {
									value: params.auctionStartPrice.toFixed(2),
									currency: this.currency,
								},
							}
						: {}),
				},
			},
		);
	}

	/** Get offers for a SKU. */
	async getOffers(sku: string): Promise<EbayApiOffer[]> {
		const result = await this.request<{
			offers: EbayApiOffer[];
			total: number;
		}>(
			"GET",
			`/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=${this.siteId}`,
		);
		return result.offers ?? [];
	}

	/** Update an existing offer. */
	async updateOffer(
		offerId: string,
		params: {
			price?: number | undefined;
			quantity?: number | undefined;
			categoryId?: string | undefined;
			description?: string | undefined;
		},
	): Promise<void> {
		const body: Record<string, unknown> = {};
		if (params.quantity !== undefined) {
			body.availableQuantity = params.quantity;
		}
		if (params.categoryId !== undefined) {
			body.categoryId = params.categoryId;
		}
		if (params.description !== undefined) {
			body.listingDescription = params.description;
		}
		if (params.price !== undefined) {
			body.pricingSummary = {
				price: {
					value: params.price.toFixed(2),
					currency: this.currency,
				},
			};
		}

		await this.request<void>(
			"PUT",
			`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`,
			body,
		);
	}

	/** Publish an offer to make it live on eBay. */
	async publishOffer(offerId: string): Promise<EbayApiPublishResponse> {
		return this.request<EbayApiPublishResponse>(
			"POST",
			`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
		);
	}

	/** Withdraw an offer (end the listing). */
	async withdrawOffer(offerId: string): Promise<EbayApiWithdrawResponse> {
		return this.request<EbayApiWithdrawResponse>(
			"POST",
			`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`,
		);
	}

	// ── Fulfillment API ──────────────────────────────────────────────────

	/** Get orders with optional filters. */
	async getOrders(params?: {
		limit?: number | undefined;
		offset?: number | undefined;
		filter?: string | undefined;
	}): Promise<EbayApiOrdersResponse> {
		const query = new URLSearchParams();
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.offset) query.set("offset", String(params.offset));
		if (params?.filter) query.set("filter", params.filter);

		const qs = query.toString();
		return this.request<EbayApiOrdersResponse>(
			"GET",
			`/sell/fulfillment/v1/order${qs ? `?${qs}` : ""}`,
		);
	}

	/** Get a specific order by ID. */
	async getOrder(orderId: string): Promise<EbayApiOrder> {
		return this.request<EbayApiOrder>(
			"GET",
			`/sell/fulfillment/v1/order/${encodeURIComponent(orderId)}`,
		);
	}

	/** Create a shipping fulfillment (mark items as shipped). */
	async createShippingFulfillment(
		orderId: string,
		params: {
			trackingNumber: string;
			carrier: string;
			lineItemIds: string[];
		},
	): Promise<string> {
		const res = await this.request<{ fulfillmentId: string }>(
			"POST",
			`/sell/fulfillment/v1/order/${encodeURIComponent(orderId)}/shipping_fulfillment`,
			{
				lineItems: params.lineItemIds.map((id) => ({
					lineItemId: id,
					quantity: 1,
				})),
				shippedDate: new Date().toISOString(),
				shippingCarrierCode: params.carrier,
				trackingNumber: params.trackingNumber,
			},
		);
		return res.fulfillmentId;
	}
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

/** Map eBay order fulfillment status to internal status. */
export function mapOrderStatus(
	fulfillmentStatus: string,
	paymentStatus: string,
	cancelState?: string | undefined,
): "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "returned" {
	if (cancelState === "CANCEL_CLOSED") return "cancelled";
	if (fulfillmentStatus === "FULFILLED") return "shipped";
	if (paymentStatus === "FULLY_REFUNDED") return "returned";
	if (paymentStatus === "PAID") return "paid";
	return "pending";
}

/** Map local condition to eBay API condition enum. */
export function mapConditionToEbay(
	condition: LocalCondition,
): EbayApiInventoryItem["condition"] {
	return CONDITION_MAP[condition] ?? "NEW";
}

/** Map eBay API condition enum to local condition. */
export function mapConditionFromEbay(condition: string): LocalCondition {
	return REVERSE_CONDITION_MAP[condition] ?? "new";
}

/** Parse eBay money string to number. */
export function parseEbayMoney(money: { value: string } | undefined): number {
	if (!money?.value) return 0;
	return Number.parseFloat(money.value) || 0;
}
