/**
 * Uber Eats Marketplace API provider.
 *
 * OAuth 2.0 client credentials auth against https://auth.uber.com/oauth/v2/token.
 * API calls via https://api.uber.com/v1/eats/...
 * Webhook verification via HMAC-SHA256 with the client secret.
 */

// ── Uber Eats API response types ────────────────────────────────────────────

export interface UberEatsOrderItem {
	id: string;
	title: string;
	quantity: number;
	price: { unit_price: { amount: number; currency_code: string } };
	selected_modifier_groups?: Array<{
		id: string;
		title: string;
		selected_items: Array<{
			id: string;
			title: string;
			quantity: number;
			price: { unit_price: { amount: number; currency_code: string } };
		}>;
	}>;
	special_instructions?: string;
}

export interface UberEatsOrderResponse {
	id: string;
	display_id: string;
	store: { id: string; name: string };
	eater: {
		first_name: string;
		last_name: string;
		phone: string;
		phone_code: string;
	};
	cart: {
		items: UberEatsOrderItem[];
		subtotal: number;
		delivery_fee: number;
		tax: number;
		total: number;
		currency_code: string;
		special_instructions?: string;
	};
	payment: { charges: { total: { amount: number; currency_code: string } } };
	type: "PICK_UP" | "DINE_IN" | "DELIVERY_BY_UBER" | "DELIVERY_BY_RESTAURANT";
	estimated_ready_for_pickup_at?: string;
	placed_at: string;
	current_state: string;
}

export interface UberEatsCreatedOrdersResponse {
	orders: UberEatsOrderResponse[];
}

export interface UberEatsCanceledOrdersResponse {
	orders: Array<{
		order_id: string;
		cancel_reason: string;
		cancelling_party: string;
	}>;
}

export interface UberEatsMenuCategory {
	id: string;
	title: { translations: Record<string, string> };
	entities: Array<{ id: string; type: "ITEM" }>;
}

export interface UberEatsMenuItem {
	id: string;
	title: { translations: Record<string, string> };
	description?: { translations: Record<string, string> };
	image_url?: string;
	price_info: {
		price: number;
		overrides?: Array<{
			context_type: string;
			context_value: string;
			price: number;
		}>;
	};
	quantity_info?: {
		quantity: { max_permitted: number; min_permitted: number };
	};
	tax_info?: { tax_rate: number };
	modifier_group_ids?: { ids: string[] };
	suspension_info?: {
		suspension: {
			suspend_until: number;
			reason: string;
		};
	};
}

export interface UberEatsModifierGroup {
	id: string;
	title: { translations: Record<string, string> };
	quantity_info?: {
		quantity: { max_permitted: number; min_permitted: number };
	};
	modifier_options: Array<{
		id: string;
		type: "ITEM";
	}>;
}

export interface UberEatsMenuPayload {
	menus: Array<{
		id: string;
		title: { translations: Record<string, string> };
		category_ids: string[];
		service_availability: Array<{
			day_of_week: string;
			time_periods: Array<{ start_time: string; end_time: string }>;
		}>;
	}>;
	categories: UberEatsMenuCategory[];
	items: UberEatsMenuItem[];
	modifier_groups?: UberEatsModifierGroup[];
	display_options?: { disable_item_instructions: boolean };
}

export interface UberEatsStoreStatus {
	status: "ONLINE" | "OFFLINE" | "PAUSED";
	offlineReason?: string;
}

export interface UberEatsApiError {
	code: string;
	message: string;
}

export interface UberEatsTokenResponse {
	access_token: string;
	expires_in: number;
	token_type: string;
	scope: string;
}

// ── Provider class ──────────────────────────────────────────────────────────

export class UberEatsProvider {
	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly restaurantId: string;
	private readonly baseUrl = "https://api.uber.com";
	private readonly authUrl = "https://auth.uber.com/oauth/v2/token";

	private accessToken: string | undefined;
	private tokenExpiresAt = 0;

	constructor(clientId: string, clientSecret: string, restaurantId: string) {
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.restaurantId = restaurantId;
	}

	/**
	 * Verify the configured clientId/clientSecret by exchanging them for an
	 * access token at Uber's OAuth2 endpoint. Returns the granted scopes so
	 * admins can detect missing permissions (e.g. orders without store-status
	 * write).
	 */
	async verifyConnection(): Promise<
		{ ok: true; scopes: string[] } | { ok: false; error: string }
	> {
		try {
			const body = new URLSearchParams({
				client_id: this.clientId,
				client_secret: this.clientSecret,
				grant_type: "client_credentials",
				scope:
					"eats.store eats.store.status.write eats.order eats.store.orders.read",
			});

			const tokenRes = await fetch(this.authUrl, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: body.toString(),
			});

			if (!tokenRes.ok) {
				let message = `HTTP ${tokenRes.status}`;
				try {
					const errBody = (await tokenRes.json()) as {
						error?: string;
						error_description?: string;
					};
					if (errBody?.error_description) {
						message = errBody.error_description;
					} else if (errBody?.error) {
						message = errBody.error;
					}
				} catch {
					const text = await tokenRes.text().catch(() => "");
					if (text) message = text.slice(0, 200);
				}
				return { ok: false, error: message };
			}

			const token = (await tokenRes.json()) as UberEatsTokenResponse;
			this.accessToken = token.access_token;
			this.tokenExpiresAt = Date.now() + (token.expires_in - 300) * 1000;

			return {
				ok: true,
				scopes: token.scope ? token.scope.split(" ").filter(Boolean) : [],
			};
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}

	// ── Authentication ───────────────────────────────────────────────────

	private async ensureToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.tokenExpiresAt) {
			return this.accessToken;
		}

		const body = new URLSearchParams({
			client_id: this.clientId,
			client_secret: this.clientSecret,
			grant_type: "client_credentials",
			scope:
				"eats.store eats.store.status.write eats.order eats.store.orders.read",
		});

		const res = await fetch(this.authUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: body.toString(),
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Uber Eats auth failed (${res.status}): ${text}`);
		}

		const token = (await res.json()) as UberEatsTokenResponse;
		this.accessToken = token.access_token;
		// Refresh 5 minutes before actual expiry
		this.tokenExpiresAt = Date.now() + (token.expires_in - 300) * 1000;
		return this.accessToken;
	}

	private async request<T>(
		method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
		path: string,
		body?: Record<string, unknown> | unknown[],
	): Promise<T> {
		const token = await this.ensureToken();
		const url = `${this.baseUrl}${path}`;

		const res = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		if (!res.ok) {
			let message = `HTTP ${res.status}`;
			try {
				const err = (await res.json()) as UberEatsApiError;
				message = err.message ?? message;
			} catch {
				// response may not be JSON
			}
			throw new Error(`Uber Eats API error: ${message}`);
		}

		const text = await res.text();
		if (!text) return undefined as T;
		return JSON.parse(text) as T;
	}

	// ── Order endpoints ──────────────────────────────────────────────────

	/**
	 * Get full order details.
	 * GET /v1/eats/order/{order_id}
	 */
	async getOrder(orderId: string): Promise<UberEatsOrderResponse> {
		return this.request<UberEatsOrderResponse>(
			"GET",
			`/v1/eats/order/${encodeURIComponent(orderId)}`,
		);
	}

	/**
	 * Get newly created orders for the store.
	 * GET /v1/eats/stores/{store_id}/created-orders
	 */
	async getCreatedOrders(): Promise<UberEatsCreatedOrdersResponse> {
		return this.request<UberEatsCreatedOrdersResponse>(
			"GET",
			`/v1/eats/stores/${encodeURIComponent(this.restaurantId)}/created-orders`,
		);
	}

	/**
	 * Get cancelled orders for the store.
	 * GET /v1/eats/stores/{store_id}/canceled-orders
	 */
	async getCanceledOrders(): Promise<UberEatsCanceledOrdersResponse> {
		return this.request<UberEatsCanceledOrdersResponse>(
			"GET",
			`/v1/eats/stores/${encodeURIComponent(this.restaurantId)}/canceled-orders`,
		);
	}

	/**
	 * Accept an order via POS integration.
	 * POST /v1/eats/orders/{order_id}/accept_pos_order
	 */
	async acceptOrder(orderId: string, reason?: string): Promise<void> {
		await this.request<void>(
			"POST",
			`/v1/eats/orders/${encodeURIComponent(orderId)}/accept_pos_order`,
			{ reason: reason ?? "Order accepted" },
		);
	}

	/**
	 * Deny an order via POS integration.
	 * POST /v1/eats/orders/{order_id}/deny_pos_order
	 */
	async denyOrder(
		orderId: string,
		reason: {
			explanation: string;
			code: "STORE_CLOSED" | "ITEM_UNAVAILABLE" | "CANNOT_FULFILL" | "OTHER";
		},
	): Promise<void> {
		await this.request<void>(
			"POST",
			`/v1/eats/orders/${encodeURIComponent(orderId)}/deny_pos_order`,
			{ reason },
		);
	}

	/**
	 * Cancel an active order.
	 * POST /v1/eats/orders/{order_id}/cancel
	 */
	async cancelOrder(
		orderId: string,
		reason: string,
		code: "OUT_OF_ITEMS" | "KITCHEN_CLOSED" | "OTHER",
	): Promise<void> {
		await this.request<void>(
			"POST",
			`/v1/eats/orders/${encodeURIComponent(orderId)}/cancel`,
			{ reason, cancelling_party: "MERCHANT", code },
		);
	}

	/**
	 * Update delivery status for restaurant-delivery orders.
	 * POST /v1/eats/orders/{order_id}/restaurantdelivery/status
	 */
	async updateDeliveryStatus(
		orderId: string,
		status: "arriving" | "delivered",
	): Promise<void> {
		await this.request<void>(
			"POST",
			`/v1/eats/orders/${encodeURIComponent(orderId)}/restaurantdelivery/status`,
			{ status },
		);
	}

	// ── Menu endpoints ───────────────────────────────────────────────────

	/**
	 * Retrieve the current menu for the store.
	 * GET /v2/eats/stores/{store_id}/menus
	 */
	async getMenu(): Promise<UberEatsMenuPayload> {
		return this.request<UberEatsMenuPayload>(
			"GET",
			`/v2/eats/stores/${encodeURIComponent(this.restaurantId)}/menus`,
		);
	}

	/**
	 * Upload (upsert) a full menu. Overwrites existing menus.
	 * PUT /v2/eats/stores/{store_id}/menus
	 */
	async uploadMenu(menu: UberEatsMenuPayload): Promise<void> {
		await this.request<void>(
			"PUT",
			`/v2/eats/stores/${encodeURIComponent(this.restaurantId)}/menus`,
			menu as unknown as Record<string, unknown>,
		);
	}

	/**
	 * Update a single menu item (e.g. mark out of stock).
	 * POST /v2/eats/stores/{store_id}/menus/items/{item_id}
	 */
	async updateMenuItem(
		itemId: string,
		update: {
			suspension_info?: {
				suspension: { suspend_until: number; reason: string };
			};
			price_info?: { price: number };
		},
	): Promise<void> {
		await this.request<void>(
			"POST",
			`/v2/eats/stores/${encodeURIComponent(this.restaurantId)}/menus/items/${encodeURIComponent(itemId)}`,
			update as unknown as Record<string, unknown>,
		);
	}

	// ── Store endpoints ──────────────────────────────────────────────────

	/**
	 * Get store online/offline status.
	 */
	async getStoreStatus(): Promise<UberEatsStoreStatus> {
		return this.request<UberEatsStoreStatus>(
			"GET",
			`/v1/eats/stores/${encodeURIComponent(this.restaurantId)}`,
		);
	}

	// ── Webhook verification ─────────────────────────────────────────────

	/**
	 * Verify an Uber Eats webhook signature.
	 * The X-Uber-Signature header is HMAC-SHA256(body, clientSecret) as lowercase hex.
	 */
	static async verifyWebhookSignature(
		body: string,
		signature: string,
		clientSecret: string,
	): Promise<boolean> {
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(clientSecret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
		const hex = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		// Timing-safe comparison
		if (hex.length !== signature.length) return false;
		let mismatch = 0;
		for (let i = 0; i < hex.length; i++) {
			mismatch |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
		}
		return mismatch === 0;
	}
}
