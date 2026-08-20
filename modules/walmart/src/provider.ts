/**
 * Walmart Marketplace API provider.
 * Makes real HTTP calls to the Walmart Marketplace v3 APIs.
 * Authentication uses OAuth 2.0 client credentials grant.
 */

// ── Walmart API response types ──────────────────────────────────────────────

export interface WalmartApiItem {
	mart: string;
	sku: string;
	wpid: string;
	upc?: string | undefined;
	gtin?: string | undefined;
	productName: string;
	shelf?: string | undefined;
	productType?: string | undefined;
	price: { currency: string; amount: number };
	publishedStatus: "PUBLISHED" | "UNPUBLISHED" | "SYSTEM_PROBLEM" | "RETIRED";
	lifecycleStatus: "ACTIVE" | "ARCHIVED" | "RETIRED";
	availabilityStatus?: string | undefined;
	shipMethods?: string[] | undefined;
	fulfillmentType?: "SELLER" | "WFS" | undefined;
}

export interface WalmartApiItemsResponse {
	ItemResponse: WalmartApiItem[];
	totalItems: number;
	nextCursor?: string | undefined;
}

export interface WalmartApiInventory {
	sku: string;
	quantity: { unit: string; amount: number };
	fulfillmentLagTime?: number | undefined;
}

export interface WalmartApiOrder {
	purchaseOrderId: string;
	customerOrderId: string;
	customerEmailId?: string | undefined;
	orderDate: string;
	shippingInfo: {
		phone?: string | undefined;
		estimatedDeliveryDate?: string | undefined;
		estimatedShipDate?: string | undefined;
		methodCode: string;
		postalAddress?: {
			name?: string | undefined;
			address1?: string | undefined;
			address2?: string | undefined;
			city?: string | undefined;
			state?: string | undefined;
			postalCode?: string | undefined;
			country?: string | undefined;
		};
	};
	orderLines: {
		orderLine: WalmartApiOrderLine[];
	};
}

export interface WalmartApiOrderLine {
	lineNumber: string;
	item: {
		productName: string;
		sku: string;
	};
	charges: {
		charge: {
			chargeType: "PRODUCT" | "SHIPPING";
			chargeAmount: { currency: string; amount: number };
			tax?: {
				taxName: string;
				taxAmount: { currency: string; amount: number };
			};
		}[];
	};
	orderLineQuantity: {
		unitOfMeasurement: string;
		amount: string;
	};
	statusDate: string;
	orderLineStatuses: {
		orderLineStatus: {
			status: string;
			statusQuantity: { unitOfMeasurement: string; amount: string };
			trackingInfo?: {
				shipDateTime?: string | undefined;
				carrierName?: { carrier: string } | undefined;
				trackingNumber?: string | undefined;
				trackingURL?: string | undefined;
			};
		}[];
	};
}

export interface WalmartApiOrdersResponse {
	list: {
		elements: {
			order: WalmartApiOrder[];
		};
		meta: {
			totalCount: number;
			limit: number;
			nextCursor?: string | undefined;
		};
	};
}

export interface WalmartApiFeedResponse {
	feedId: string;
	feedStatus?: string | undefined;
	ingestionErrors?: {
		ingestionError: {
			type: string;
			code: string;
			description: string;
		}[];
	};
}

export interface WalmartApiFeedStatusResponse {
	feedId: string;
	feedSource: string;
	feedType: string;
	partnerId: string;
	itemsReceived: number;
	itemsSucceeded: number;
	itemsFailed: number;
	itemsProcessing: number;
	feedStatus: "RECEIVED" | "INPROGRESS" | "PROCESSED" | "ERROR";
	feedDate: string;
	modifiedDtm: string;
	itemDataErrorCount?: number | undefined;
	itemSystemErrorCount?: number | undefined;
	itemTimeoutErrorCount?: number | undefined;
}

export interface WalmartApiErrorResponse {
	errors?: {
		code: string;
		message: string;
		category?: string | undefined;
		severity?: string | undefined;
		field?: string | undefined;
	}[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const WALMART_API_BASE = "https://marketplace.walmartapis.com";
const WALMART_SANDBOX_API_BASE = "https://sandbox.walmartapis.com";

const WALMART_TOKEN_PATH = "/v3/token";

// ── Provider class ───────────────────────────────────────────────────────────

export interface WalmartProviderConfig {
	clientId: string;
	clientSecret: string;
	/** Channel type designation provided during onboarding. */
	channelType?: string | undefined;
	sandbox?: boolean | undefined;
}

export class WalmartProvider {
	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly channelType: string;
	private readonly baseUrl: string;
	private readonly sandbox: boolean;

	private accessToken: string | null = null;
	private tokenExpiresAt = 0;

	constructor(config: WalmartProviderConfig) {
		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;
		this.channelType = config.channelType ?? "";
		this.sandbox = Boolean(config.sandbox);
		this.baseUrl = config.sandbox ? WALMART_SANDBOX_API_BASE : WALMART_API_BASE;
	}

	/**
	 * Verify the configured clientId and clientSecret by exchanging them for
	 * an OAuth2 access token. Returns whether the credentials were accepted
	 * and whether the sandbox or production endpoint was hit so admins can
	 * tell at a glance which environment is active.
	 */
	async verifyConnection(): Promise<
		{ ok: true; mode: "sandbox" | "live" } | { ok: false; error: string }
	> {
		try {
			const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
			const res = await fetch(`${this.baseUrl}${WALMART_TOKEN_PATH}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization: `Basic ${credentials}`,
					Accept: "application/json",
					"WM_SVC.NAME": "86d-Commerce",
					"WM_QOS.CORRELATION_ID": crypto.randomUUID(),
				},
				body: new URLSearchParams({
					grant_type: "client_credentials",
				}).toString(),
			});

			if (!res.ok) {
				let message = `HTTP ${res.status}`;
				try {
					const body = (await res.json()) as WalmartApiErrorResponse & {
						error_description?: string;
						error?: string;
					};
					if (body?.error_description) {
						message = body.error_description;
					} else if (body?.error) {
						message = body.error;
					} else if (body?.errors?.[0]?.message) {
						message = body.errors[0].message;
					}
				} catch {
					// Fall back to HTTP status message
				}
				return { ok: false, error: message };
			}

			const data = (await res.json()) as {
				access_token: string;
				expires_in: number;
				token_type: string;
			};
			this.accessToken = data.access_token;
			this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
			return {
				ok: true,
				mode: this.sandbox ? "sandbox" : "live",
			};
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}

	/** Obtain a fresh OAuth2 access token via client credentials grant. */
	private async getAccessToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.tokenExpiresAt) {
			return this.accessToken;
		}

		const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
		const res = await fetch(`${this.baseUrl}${WALMART_TOKEN_PATH}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${credentials}`,
				Accept: "application/json",
				"WM_SVC.NAME": "86d-Commerce",
				"WM_QOS.CORRELATION_ID": crypto.randomUUID(),
			},
			body: new URLSearchParams({
				grant_type: "client_credentials",
			}).toString(),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(
				`Walmart OAuth token error: HTTP ${res.status} ${text}`.trim(),
			);
		}

		const data = (await res.json()) as {
			access_token: string;
			token_type: string;
			expires_in: number;
		};
		this.accessToken = data.access_token;
		this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
		return this.accessToken;
	}

	/** Make an authenticated request to the Walmart Marketplace API. */
	private async request<T>(
		method: "GET" | "POST" | "PUT" | "DELETE",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const token = await this.getAccessToken();
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				"WM_SEC.ACCESS_TOKEN": token,
				"WM_SVC.NAME": "86d-Commerce",
				"WM_QOS.CORRELATION_ID": crypto.randomUUID(),
				...(this.channelType
					? { "WM_CONSUMER.CHANNEL.TYPE": this.channelType }
					: {}),
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		if (!res.ok) {
			const errBody = (await res
				.json()
				.catch(() => null)) as WalmartApiErrorResponse | null;
			const msg = errBody?.errors?.[0]?.message ?? `HTTP ${res.status}`;
			throw new Error(`Walmart API error: ${msg}`);
		}

		if (res.status === 204) return undefined as T;

		const text = await res.text();
		if (!text) return undefined as T;
		return JSON.parse(text) as T;
	}

	// ── Items API ─────────────────────────────────────────────────────────

	/** Get all items (paginated). */
	async getItems(params?: {
		limit?: number | undefined;
		nextCursor?: string | undefined;
	}): Promise<WalmartApiItemsResponse> {
		const query = new URLSearchParams();
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.nextCursor) query.set("nextCursor", params.nextCursor);

		const qs = query.toString();
		return this.request<WalmartApiItemsResponse>(
			"GET",
			`/v3/items${qs ? `?${qs}` : ""}`,
		);
	}

	/** Get a single item by ID. */
	async getItem(itemId: string): Promise<WalmartApiItem> {
		return this.request<WalmartApiItem>(
			"GET",
			`/v3/items/${encodeURIComponent(itemId)}`,
		);
	}

	/** Retire an item. */
	async retireItem(sku: string): Promise<void> {
		await this.request<void>("DELETE", `/v3/items/${encodeURIComponent(sku)}`);
	}

	// ── Inventory API ─────────────────────────────────────────────────────

	/** Get inventory for a SKU. */
	async getInventory(sku: string): Promise<WalmartApiInventory> {
		return this.request<WalmartApiInventory>(
			"GET",
			`/v3/inventory?sku=${encodeURIComponent(sku)}`,
		);
	}

	/** Update inventory for a SKU. */
	async updateInventory(
		sku: string,
		quantity: number,
	): Promise<WalmartApiInventory> {
		return this.request<WalmartApiInventory>(
			"PUT",
			`/v3/inventory?sku=${encodeURIComponent(sku)}`,
			{
				sku,
				quantity: {
					unit: "EACH",
					amount: quantity,
				},
			},
		);
	}

	// ── Feeds API ─────────────────────────────────────────────────────────

	/** Submit a feed. */
	async submitFeed(
		feedType: string,
		items: Record<string, unknown>[],
	): Promise<WalmartApiFeedResponse> {
		return this.request<WalmartApiFeedResponse>(
			"POST",
			`/v3/feeds?feedType=${encodeURIComponent(feedType)}`,
			{ items },
		);
	}

	/** Get feed status. */
	async getFeedStatus(feedId: string): Promise<WalmartApiFeedStatusResponse> {
		return this.request<WalmartApiFeedStatusResponse>(
			"GET",
			`/v3/feeds/${encodeURIComponent(feedId)}`,
		);
	}

	// ── Orders API ────────────────────────────────────────────────────────

	/** Get orders with optional filters. */
	async getOrders(params?: {
		createdStartDate?: string | undefined;
		createdEndDate?: string | undefined;
		limit?: number | undefined;
		nextCursor?: string | undefined;
		status?: string | undefined;
	}): Promise<WalmartApiOrdersResponse> {
		const query = new URLSearchParams();
		if (params?.createdStartDate)
			query.set("createdStartDate", params.createdStartDate);
		if (params?.createdEndDate)
			query.set("createdEndDate", params.createdEndDate);
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.nextCursor) query.set("nextCursor", params.nextCursor);
		if (params?.status) query.set("status", params.status);

		const qs = query.toString();
		return this.request<WalmartApiOrdersResponse>(
			"GET",
			`/v3/orders${qs ? `?${qs}` : ""}`,
		);
	}

	/** Get a specific order. */
	async getOrder(purchaseOrderId: string): Promise<WalmartApiOrder> {
		const result = await this.request<{
			order: WalmartApiOrder;
		}>("GET", `/v3/orders/${encodeURIComponent(purchaseOrderId)}`);
		return result.order;
	}

	/** Acknowledge an order. */
	async acknowledgeOrder(purchaseOrderId: string): Promise<void> {
		await this.request<void>(
			"POST",
			`/v3/orders/${encodeURIComponent(purchaseOrderId)}/acknowledge`,
		);
	}

	/** Ship order lines. */
	async shipOrder(
		purchaseOrderId: string,
		params: {
			lineNumbers: string[];
			trackingNumber: string;
			carrier: string;
			methodCode?: string | undefined;
		},
	): Promise<void> {
		await this.request<void>(
			"POST",
			`/v3/orders/${encodeURIComponent(purchaseOrderId)}/shipping`,
			{
				orderShipment: {
					orderLines: params.lineNumbers.map((lineNumber) => ({
						lineNumber,
						orderLineStatuses: [
							{
								status: "Shipped",
								statusQuantity: {
									unitOfMeasurement: "EACH",
									amount: "1",
								},
								trackingInfo: {
									shipDateTime: new Date().toISOString(),
									carrierName: {
										carrier: params.carrier,
									},
									methodCode: params.methodCode ?? "Standard",
									trackingNumber: params.trackingNumber,
								},
							},
						],
					})),
				},
			},
		);
	}

	/** Cancel order lines. */
	async cancelOrder(
		purchaseOrderId: string,
		lineNumbers: string[],
	): Promise<void> {
		await this.request<void>(
			"POST",
			`/v3/orders/${encodeURIComponent(purchaseOrderId)}/cancellation`,
			{
				orderCancellation: {
					orderLines: lineNumbers.map((lineNumber) => ({
						lineNumber,
						orderLineStatuses: [
							{
								status: "Cancelled",
								cancellationReason: "CANCEL_BY_SELLER",
								statusQuantity: {
									unitOfMeasurement: "EACH",
									amount: "1",
								},
							},
						],
					})),
				},
			},
		);
	}
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

/** Map Walmart publishedStatus to internal ItemStatus. */
export function mapItemStatus(
	publishedStatus: string,
): "published" | "unpublished" | "retired" | "system-error" {
	switch (publishedStatus) {
		case "PUBLISHED":
			return "published";
		case "UNPUBLISHED":
			return "unpublished";
		case "RETIRED":
			return "retired";
		case "SYSTEM_PROBLEM":
			return "system-error";
		default:
			return "unpublished";
	}
}

/** Map Walmart fulfillment type to internal type. */
export function mapFulfillmentType(
	fulfillmentType: string | undefined,
): "seller" | "wfs" {
	return fulfillmentType === "WFS" ? "wfs" : "seller";
}

/** Map Walmart feed status to internal FeedStatus. */
export function mapFeedStatus(
	status: string,
): "pending" | "processing" | "completed" | "error" {
	switch (status) {
		case "RECEIVED":
			return "pending";
		case "INPROGRESS":
			return "processing";
		case "PROCESSED":
			return "completed";
		case "ERROR":
			return "error";
		default:
			return "pending";
	}
}

/** Map Walmart order line status to internal WalmartOrderStatus. */
export function mapOrderStatus(
	orderLineStatuses: string[],
):
	| "created"
	| "acknowledged"
	| "shipped"
	| "delivered"
	| "cancelled"
	| "refunded" {
	if (orderLineStatuses.includes("Cancelled")) return "cancelled";
	if (orderLineStatuses.includes("Refund")) return "refunded";
	if (orderLineStatuses.includes("Delivered")) return "delivered";
	if (orderLineStatuses.includes("Shipped")) return "shipped";
	if (orderLineStatuses.includes("Acknowledged")) return "acknowledged";
	return "created";
}

/** Extract total charges from order lines. */
export function extractOrderTotals(orderLines: WalmartApiOrderLine[]): {
	orderTotal: number;
	shippingTotal: number;
	tax: number;
} {
	let orderTotal = 0;
	let shippingTotal = 0;
	let tax = 0;

	for (const line of orderLines) {
		for (const charge of line.charges.charge) {
			const amount = charge.chargeAmount.amount;
			if (charge.chargeType === "PRODUCT") {
				orderTotal += amount;
			} else if (charge.chargeType === "SHIPPING") {
				shippingTotal += amount;
			}
			if (charge.tax) {
				tax += charge.tax.taxAmount.amount;
			}
		}
	}

	return { orderTotal, shippingTotal, tax };
}
