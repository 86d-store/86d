/**
 * Wish Merchant API v2 provider.
 * Makes real HTTP calls to https://merchant.wish.com/api/v2/.
 * Authentication uses an access_token appended to every request.
 */

const BASE_URL = "https://merchant.wish.com/api/v2";

// ── Wish API response types ──────────────────────────────────────────────────

interface WishApiResponse<T = unknown> {
	code: number;
	data?: T;
	message?: string;
}

export interface WishApiProduct {
	id: string;
	parent_sku?: string | undefined;
	name: string;
	description?: string | undefined;
	tags: string[];
	price: { amount: number; currency_code: string };
	shipping: { amount: number; currency_code: string };
	inventory?: number | undefined;
	enabled: boolean;
	review_status?: string | undefined;
	main_image?: string | undefined;
}

export interface WishApiOrder {
	order_id: string;
	order_time: number;
	buyer_name?: string | undefined;
	price: { amount: number; currency_code: string };
	shipping: { amount: number; currency_code: string };
	wish_merchant_fee?: number | undefined;
	quantity: number;
	product_id: string;
	product_name: string;
	sku?: string | undefined;
	tracking_number?: string | null | undefined;
	carrier?: string | null | undefined;
	state: string;
	ship_by_date?: number | null | undefined;
	deliver_by_date?: number | null | undefined;
	shipping_detail?: Record<string, unknown> | undefined;
}

export interface WishApiErrorResponse {
	code: number;
	message: string;
}

export interface WishProviderConfig {
	accessToken: string;
}

export interface CreateWishProductParams {
	parentSku?: string | undefined;
	name: string;
	description?: string | undefined;
	tags?: string[] | undefined;
	mainImage?: string | undefined;
	basePrice: number;
	shipping: number;
	inventory?: number | undefined;
}

export interface UpdateWishProductParams {
	name?: string | undefined;
	basePrice?: number | undefined;
	shipping?: number | undefined;
	inventory?: number | undefined;
	tags?: string[] | undefined;
}

export interface ShipOrderParams {
	orderId: string;
	trackingNumber: string;
	carrier: string;
	shippingDate?: string | undefined;
}

// ── WishProvider ─────────────────────────────────────────────────────────────

export class WishProvider {
	private readonly accessToken: string;

	constructor(config: WishProviderConfig) {
		this.accessToken = config.accessToken;
	}

	private buildQuery(
		params: Record<string, string | number | undefined>,
	): string {
		const qs = new URLSearchParams();
		qs.set("access_token", this.accessToken);
		for (const [k, v] of Object.entries(params)) {
			if (v !== undefined) qs.set(k, String(v));
		}
		return qs.toString();
	}

	private buildFormBody(
		params: Record<string, string | number | undefined>,
	): string {
		const body = new URLSearchParams();
		body.set("access_token", this.accessToken);
		for (const [k, v] of Object.entries(params)) {
			if (v !== undefined) body.set(k, String(v));
		}
		return body.toString();
	}

	private async call<T>(
		method: "GET" | "POST" | "PUT" | "DELETE",
		path: string,
		params: Record<string, string | number | undefined> = {},
	): Promise<WishApiResponse<T>> {
		let url: string;
		let body: string | undefined;
		const headers: Record<string, string> = {};

		if (method === "GET" || method === "DELETE") {
			url = `${BASE_URL}${path}?${this.buildQuery(params)}`;
		} else {
			url = `${BASE_URL}${path}`;
			body = this.buildFormBody(params);
			headers["Content-Type"] = "application/x-www-form-urlencoded";
		}

		const init: RequestInit = { method, headers };
		if (body !== undefined) init.body = body;
		const res = await fetch(url, init);

		if (!res.ok && res.status !== 400 && res.status !== 422) {
			throw new Error(`Wish API HTTP ${res.status} on ${method} ${path}`);
		}

		return (await res.json()) as WishApiResponse<T>;
	}

	// ── Products ─────────────────────────────────────────────────────────────

	async createProduct(
		params: CreateWishProductParams,
	): Promise<WishApiProduct> {
		const res = await this.call<{ Product: WishApiProduct }>("POST", "/add", {
			...(params.parentSku ? { parent_sku: params.parentSku } : {}),
			name: params.name,
			...(params.description ? { description: params.description } : {}),
			...(params.tags?.length ? { tags: params.tags.join(",") } : {}),
			...(params.mainImage ? { main_image: params.mainImage } : {}),
			base_price: params.basePrice,
			shipping: params.shipping,
			...(params.inventory !== undefined
				? { inventory: params.inventory }
				: {}),
		});

		if (res.code !== 0 || !res.data?.Product) {
			throw new Error(
				`Wish API error creating product: ${res.message ?? `code ${res.code}`}`,
			);
		}
		return res.data.Product;
	}

	async updateProduct(
		wishProductId: string,
		params: UpdateWishProductParams,
	): Promise<WishApiProduct> {
		const res = await this.call<{ Product: WishApiProduct }>("PUT", "/update", {
			id: wishProductId,
			...(params.name !== undefined ? { name: params.name } : {}),
			...(params.basePrice !== undefined
				? { base_price: params.basePrice }
				: {}),
			...(params.shipping !== undefined ? { shipping: params.shipping } : {}),
			...(params.inventory !== undefined
				? { inventory: params.inventory }
				: {}),
			...(params.tags?.length ? { tags: params.tags.join(",") } : {}),
		});

		if (res.code !== 0 || !res.data?.Product) {
			throw new Error(
				`Wish API error updating product ${wishProductId}: ${res.message ?? `code ${res.code}`}`,
			);
		}
		return res.data.Product;
	}

	async disableProduct(wishProductId: string): Promise<void> {
		const res = await this.call<unknown>("DELETE", "/remove", {
			id: wishProductId,
		});
		if (res.code !== 0) {
			throw new Error(
				`Wish API error disabling product ${wishProductId}: ${res.message ?? `code ${res.code}`}`,
			);
		}
	}

	async getProduct(wishProductId: string): Promise<WishApiProduct | null> {
		const res = await this.call<{ Product: WishApiProduct }>(
			"GET",
			"/product",
			{
				id: wishProductId,
			},
		);
		if (res.code !== 0) return null;
		return res.data?.Product ?? null;
	}

	// ── Orders ───────────────────────────────────────────────────────────────

	async listOrders(params: {
		since?: number | undefined;
		count?: number | undefined;
		state?: string | undefined;
	}): Promise<WishApiOrder[]> {
		const res = await this.call<{ orders: WishApiOrder[] }>("GET", "/order", {
			...(params.since !== undefined ? { since: params.since } : {}),
			count: params.count ?? 50,
			...(params.state ? { state: params.state } : {}),
		});
		if (res.code !== 0) return [];
		return res.data?.orders ?? [];
	}

	async shipOrder(params: ShipOrderParams): Promise<void> {
		const res = await this.call<unknown>("POST", "/order/fulfill-one", {
			id: params.orderId,
			tracking_number: params.trackingNumber,
			carrier: params.carrier,
			...(params.shippingDate ? { shipping_date: params.shippingDate } : {}),
		});
		if (res.code !== 0) {
			throw new Error(
				`Wish API error shipping order ${params.orderId}: ${res.message ?? `code ${res.code}`}`,
			);
		}
	}
}
