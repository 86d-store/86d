/**
 * Meta Graph API provider for Instagram Commerce.
 * Instagram Shopping uses the same Meta Commerce Platform as Facebook Shop.
 * Makes real HTTP calls to https://graph.facebook.com/.
 * Authentication uses a long-lived page/business access token.
 */

// ── Meta Graph API types ────────────────────────────────────────────────────

export interface MetaProduct {
	id: string;
	retailer_id: string;
	name: string;
	description?: string | undefined;
	availability?: string | undefined;
	price?: string | undefined;
	currency?: string | undefined;
	image_url?: string | undefined;
	url?: string | undefined;
	brand?: string | undefined;
	condition?: string | undefined;
	inventory?: number | undefined;
	visibility?: string | undefined;
}

export interface MetaProductCreateParams {
	retailer_id: string;
	name: string;
	description?: string | undefined;
	availability?: string | undefined;
	price: number;
	currency?: string | undefined;
	image_url: string;
	url?: string | undefined;
	brand?: string | undefined;
	condition?: string | undefined;
	inventory?: number | undefined;
}

export interface MetaCommerceOrder {
	id: string;
	order_status: {
		state: string;
	};
	created: string;
	last_updated: string;
	items?: {
		data: MetaOrderItem[];
	};
	buyer_details?: {
		name: string;
		email?: string | undefined;
	};
	shipping_address?: {
		street1?: string | undefined;
		street2?: string | undefined;
		city?: string | undefined;
		state?: string | undefined;
		postal_code?: string | undefined;
		country?: string | undefined;
		name?: string | undefined;
	};
	estimated_payment_details?: {
		subtotal: { amount: string; currency: string };
		tax: { amount: string; currency: string };
		total_amount: { amount: string; currency: string };
		shipping?: { amount: string; currency: string };
	};
	channel?: string | undefined;
}

export interface MetaOrderItem {
	id: string;
	product_id: string;
	retailer_id: string;
	quantity: number;
	price_per_unit: { amount: string; currency: string };
}

export interface MetaPaginatedResponse<T> {
	data: T[];
	paging?: {
		cursors?: { before?: string; after?: string };
		next?: string;
	};
	summary?: { total_count?: number };
}

export interface MetaErrorResponse {
	error: {
		message: string;
		type: string;
		code: number;
		fbtrace_id?: string | undefined;
	};
}

// ── Constants ───────────────────────────────────────────────────────────────

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ── Provider class ──────────────────────────────────────────────────────────

export interface MetaInstagramProviderConfig {
	accessToken: string;
	catalogId: string;
	commerceAccountId: string;
	businessId?: string | undefined;
}

export class MetaInstagramProvider {
	private readonly accessToken: string;
	private readonly catalogId: string;
	private readonly commerceAccountId: string;
	readonly businessId: string | undefined;

	constructor(config: MetaInstagramProviderConfig) {
		this.accessToken = config.accessToken;
		this.catalogId = config.catalogId;
		this.commerceAccountId = config.commerceAccountId;
		this.businessId = config.businessId;
	}

	private async request<T>(
		method: "GET" | "POST" | "DELETE",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const url = `${GRAPH_API_BASE}${path}`;
		const separator = path.includes("?") ? "&" : "?";
		const authedUrl = `${url}${separator}access_token=${encodeURIComponent(this.accessToken)}`;

		const res = await fetch(authedUrl, {
			method,
			...(body !== undefined
				? {
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(body),
					}
				: {}),
		});

		if (!res.ok) {
			const errBody = (await res
				.json()
				.catch(() => null)) as MetaErrorResponse | null;
			const msg = errBody?.error?.message ?? `HTTP ${res.status}`;
			throw new Error(`Meta Graph API error: ${msg}`);
		}

		return (await res.json()) as T;
	}

	// ── Connection verification ──────────────────────────────────────────

	/**
	 * Verify that the access token and catalog ID are valid by listing products.
	 */
	async verifyConnection(): Promise<
		{ ok: true } | { ok: false; error: string }
	> {
		try {
			await this.listProducts({ limit: 1 });
			return { ok: true };
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}

	// ── Catalog / Product operations ──────────────────────────────────────

	/** Create a product in the catalog. */
	async createProduct(
		params: MetaProductCreateParams,
	): Promise<{ id: string }> {
		return this.request<{ id: string }>("POST", `/${this.catalogId}/products`, {
			retailer_id: params.retailer_id,
			name: params.name,
			description: params.description,
			availability: params.availability ?? "in stock",
			price: String(params.price * 100),
			currency: params.currency ?? "USD",
			image_url: params.image_url,
			url: params.url,
			brand: params.brand,
			condition: params.condition ?? "new",
			...(params.inventory !== undefined
				? { inventory: params.inventory }
				: {}),
		});
	}

	/** Update an existing product item. */
	async updateProduct(
		productId: string,
		params: Partial<MetaProductCreateParams>,
	): Promise<{ success: boolean }> {
		const body: Record<string, unknown> = {};
		if (params.name !== undefined) body.name = params.name;
		if (params.description !== undefined) body.description = params.description;
		if (params.availability !== undefined)
			body.availability = params.availability;
		if (params.price !== undefined) body.price = String(params.price * 100);
		if (params.currency !== undefined) body.currency = params.currency;
		if (params.image_url !== undefined) body.image_url = params.image_url;
		if (params.url !== undefined) body.url = params.url;
		if (params.brand !== undefined) body.brand = params.brand;
		if (params.condition !== undefined) body.condition = params.condition;
		if (params.inventory !== undefined) body.inventory = params.inventory;

		return this.request<{ success: boolean }>(
			"POST",
			`/${encodeURIComponent(productId)}`,
			body,
		);
	}

	/** Delete a product item. */
	async deleteProduct(productId: string): Promise<{ success: boolean }> {
		return this.request<{ success: boolean }>(
			"DELETE",
			`/${encodeURIComponent(productId)}`,
		);
	}

	/** List products in the catalog. */
	async listProducts(params?: {
		fields?: string | undefined;
		limit?: number | undefined;
		after?: string | undefined;
	}): Promise<MetaPaginatedResponse<MetaProduct>> {
		const query = new URLSearchParams();
		query.set(
			"fields",
			params?.fields ??
				"id,retailer_id,name,description,availability,price,currency,image_url,url,brand,inventory,visibility",
		);
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.after) query.set("after", params.after);

		return this.request<MetaPaginatedResponse<MetaProduct>>(
			"GET",
			`/${this.catalogId}/products?${query.toString()}`,
		);
	}

	/** Get a single product item. */
	async getProduct(productId: string): Promise<MetaProduct> {
		const query = new URLSearchParams();
		query.set(
			"fields",
			"id,retailer_id,name,description,availability,price,currency,image_url,url,brand,inventory,visibility",
		);
		return this.request<MetaProduct>(
			"GET",
			`/${encodeURIComponent(productId)}?${query.toString()}`,
		);
	}

	// ── Commerce Order operations ────────────────────────────────────────

	/** List orders for the commerce account. */
	async listOrders(params?: {
		state?: string | undefined;
		updatedAfter?: number | undefined;
		updatedBefore?: number | undefined;
	}): Promise<MetaPaginatedResponse<MetaCommerceOrder>> {
		const query = new URLSearchParams();
		query.set(
			"fields",
			"id,order_status,created,last_updated,items{id,product_id,retailer_id,quantity,price_per_unit},buyer_details,shipping_address,estimated_payment_details,channel",
		);
		if (params?.state) query.set("state", params.state);
		if (params?.updatedAfter)
			query.set("updated_after", String(params.updatedAfter));
		if (params?.updatedBefore)
			query.set("updated_before", String(params.updatedBefore));

		return this.request<MetaPaginatedResponse<MetaCommerceOrder>>(
			"GET",
			`/${this.commerceAccountId}/commerce_orders?${query.toString()}`,
		);
	}

	/** Get a specific order by ID. */
	async getOrder(orderId: string): Promise<MetaCommerceOrder> {
		const query = new URLSearchParams();
		query.set(
			"fields",
			"id,order_status,created,last_updated,items{id,product_id,retailer_id,quantity,price_per_unit},buyer_details,shipping_address,estimated_payment_details,channel",
		);
		return this.request<MetaCommerceOrder>(
			"GET",
			`/${encodeURIComponent(orderId)}?${query.toString()}`,
		);
	}

	/** Create a shipment for an order (fulfillment). */
	async createShipment(
		orderId: string,
		params: {
			trackingNumber: string;
			carrier: string;
			items: { retailer_id: string; quantity: number }[];
		},
	): Promise<{ success: boolean }> {
		return this.request<{ success: boolean }>(
			"POST",
			`/${encodeURIComponent(orderId)}/shipments`,
			{
				idempotency_key: crypto.randomUUID(),
				tracking_info: {
					carrier: params.carrier,
					tracking_number: params.trackingNumber,
				},
				items: params.items.map((i) => ({
					retailer_id: i.retailer_id,
					quantity: i.quantity,
				})),
			},
		);
	}
}

// ── Mapping helpers ─────────────────────────────────────────────────────────

/** Map Meta commerce order state to internal status. */
export function mapMetaOrderStatus(
	state: string,
):
	| "pending"
	| "confirmed"
	| "shipped"
	| "delivered"
	| "cancelled"
	| "refunded" {
	switch (state) {
		case "FB_PROCESSING":
		case "CREATED":
			return "pending";
		case "IN_PROGRESS":
			return "confirmed";
		case "COMPLETED":
			return "delivered";
		default:
			return "pending";
	}
}

/** Parse Meta money amount (cents string) to dollar number. */
export function parseMetaMoney(amount: string | undefined): number {
	if (!amount) return 0;
	const cents = Number.parseInt(amount, 10);
	return Number.isNaN(cents) ? 0 : cents / 100;
}

// ── Webhook signature verification ──────────────────────────────────────────

/**
 * Verify a Meta webhook signature.
 * Meta signs webhook payloads with HMAC-SHA256 using the app secret.
 * The signature is sent in the X-Hub-Signature-256 header as "sha256=<hex>".
 */
export async function verifyWebhookSignature(
	payload: string,
	signature: string,
	appSecret: string,
): Promise<boolean> {
	const prefix = "sha256=";
	const hex = signature.startsWith(prefix)
		? signature.slice(prefix.length)
		: signature;

	if (!hex) return false;

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(appSecret),
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
	if (computedHex.length !== hex.length) return false;
	let mismatch = 0;
	for (let i = 0; i < computedHex.length; i++) {
		mismatch |= computedHex.charCodeAt(i) ^ hex.charCodeAt(i);
	}
	return mismatch === 0;
}
