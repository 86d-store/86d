/**
 * Toast POS REST API provider.
 *
 * Calls Toast's API to sync menu items, orders, and stock inventory.
 * Uses OAuth access token auth with Toast-Restaurant-External-ID header.
 * Set sandbox mode to use ws-sandbox-api.toasttab.com.
 */

// ── Toast API response types ────────────────────────────────────────────────

export interface ToastMenuItem {
	guid: string;
	name: string;
	description?: string | undefined;
	sku?: string | undefined;
	plu?: string | undefined;
	price: number;
	visibility: "ALL" | "POS_ONLY" | "KIOSK_ONLY" | "NONE";
	unitOfMeasure?: "NONE" | "LB" | "OZ" | "KG" | "G" | undefined;
	calories?: number | undefined;
	imageUrl?: string | undefined;
}

export interface ToastMenuGroup {
	guid: string;
	name: string;
	description?: string | undefined;
	menuItems: ToastMenuItem[];
}

export interface ToastMenu {
	guid: string;
	name: string;
	description?: string | undefined;
	menuGroups: ToastMenuGroup[];
}

export interface ToastMenusResponse {
	menus: ToastMenu[];
}

export interface ToastOrder {
	guid: string;
	entityType: string;
	externalId?: string | undefined;
	displayNumber: string;
	createdDate: string;
	modifiedDate: string;
	paidDate?: string | undefined;
	closedDate?: string | undefined;
	estimatedFulfillmentDate?: string | undefined;
	numberOfGuests?: number | undefined;
	diningOption?: { guid: string; name: string } | undefined;
	checks: ToastCheck[];
	totalAmount: number;
	netAmount?: number | undefined;
	taxAmount?: number | undefined;
	tipAmount?: number | undefined;
}

export interface ToastCheck {
	guid: string;
	displayNumber: string;
	amount: number;
	taxAmount: number;
	totalAmount: number;
	selections: ToastSelection[];
	payments: ToastPayment[];
}

export interface ToastSelection {
	guid: string;
	itemGuid?: string | undefined;
	displayName: string;
	quantity: number;
	unitPrice: number;
	price: number;
	tax: number;
}

export interface ToastPayment {
	guid: string;
	type: string;
	amount: number;
	tipAmount: number;
	refundStatus?: "NONE" | "PARTIAL" | "FULL" | undefined;
}

export interface ToastOrdersResponse {
	orders: ToastOrder[];
	nextPageToken?: string | undefined;
}

export interface ToastStockItem {
	guid: string;
	menuItemGuid: string;
	quantity: number;
	status: "IN_STOCK" | "OUT_OF_STOCK" | "QUANTITY";
}

export interface ToastApiErrorResponse {
	status: number;
	messageCode?: string | undefined;
	message: string;
}

// ── Provider class ──────────────────────────────────────────────────────────

export class ToastPosProvider {
	private readonly accessToken: string;
	private readonly restaurantGuid: string;
	private readonly baseUrl: string;

	constructor(
		accessToken: string,
		restaurantGuid: string,
		options?: { sandbox?: boolean | undefined },
	) {
		this.accessToken = accessToken;
		this.restaurantGuid = restaurantGuid;
		this.baseUrl =
			options?.sandbox !== false
				? "https://ws-sandbox-api.toasttab.com"
				: "https://ws-api.toasttab.com";
	}

	private async request<T>(
		method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
		path: string,
		body?: Record<string, unknown> | unknown[],
	): Promise<T> {
		const url = `${this.baseUrl}${path}`;

		const res = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${this.accessToken}`,
				"Toast-Restaurant-External-ID": this.restaurantGuid,
				"Content-Type": "application/json",
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		if (method === "DELETE" && res.ok) {
			return undefined as T;
		}

		if (!res.ok) {
			let message = `HTTP ${res.status}`;
			try {
				const err = (await res.json()) as ToastApiErrorResponse;
				message = err.message ?? message;
			} catch {
				// body may not be JSON
			}
			throw new Error(`Toast API error: ${message}`);
		}

		const text = await res.text();
		if (!text) return undefined as T;
		return JSON.parse(text) as T;
	}

	// ── Connection verification ──────────────────────────────────────────

	/**
	 * Verify that the access token and restaurant GUID are valid by
	 * fetching the menus endpoint.
	 */
	async verifyConnection(): Promise<
		{ ok: true; menuCount: number } | { ok: false; error: string }
	> {
		try {
			const menus = await this.getMenus();
			return { ok: true, menuCount: menus.length };
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}

	// ── Menu endpoints ────────────────────────────────────────────────────

	/**
	 * Fetch all menus for the restaurant.
	 * GET /menus/v2/menus
	 */
	async getMenus(): Promise<ToastMenu[]> {
		const data = await this.request<ToastMenu[]>("GET", "/menus/v2/menus");
		return data ?? [];
	}

	/**
	 * Get a single menu item by GUID.
	 * GET /menus/v2/menuItems/{guid}
	 */
	async getMenuItem(guid: string): Promise<ToastMenuItem> {
		return this.request<ToastMenuItem>(
			"GET",
			`/menus/v2/menuItems/${encodeURIComponent(guid)}`,
		);
	}

	// ── Order endpoints ───────────────────────────────────────────────────

	/**
	 * Fetch orders within a date range.
	 * GET /orders/v2/orders
	 */
	async getOrders(params: {
		startDate: string;
		endDate: string;
		pageSize?: number | undefined;
		pageToken?: string | undefined;
	}): Promise<ToastOrdersResponse> {
		const query = new URLSearchParams({
			startDate: params.startDate,
			endDate: params.endDate,
		});
		if (params.pageSize) query.set("pageSize", String(params.pageSize));
		if (params.pageToken) query.set("page", params.pageToken);

		const orders = await this.request<ToastOrder[]>(
			"GET",
			`/orders/v2/orders?${query.toString()}`,
		);
		return { orders: orders ?? [] };
	}

	/**
	 * Get a single order by GUID.
	 * GET /orders/v2/orders/{guid}
	 */
	async getOrder(guid: string): Promise<ToastOrder> {
		return this.request<ToastOrder>(
			"GET",
			`/orders/v2/orders/${encodeURIComponent(guid)}`,
		);
	}

	// ── Stock / inventory endpoints ───────────────────────────────────────

	/**
	 * Get current stock for all items.
	 * GET /stock/v1/inventory
	 */
	async getInventory(): Promise<ToastStockItem[]> {
		const data = await this.request<ToastStockItem[]>(
			"GET",
			"/stock/v1/inventory",
		);
		return data ?? [];
	}

	/**
	 * Update stock status/quantity for menu items.
	 * POST /stock/v1/inventory
	 */
	async updateStock(
		items: Array<{
			menuItemGuid: string;
			quantity?: number | undefined;
			status: "IN_STOCK" | "OUT_OF_STOCK" | "QUANTITY";
		}>,
	): Promise<void> {
		await this.request<void>(
			"POST",
			"/stock/v1/inventory",
			items as unknown as unknown[],
		);
	}
}
