import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UberEatsMenuPayload } from "../provider";
import { UberEatsProvider } from "../provider";

// ── Realistic API response fixtures ─────────────────────────────────────────

const TOKEN_RESPONSE = {
	access_token: "KA.ewogICJ2ZXJzaW9uIjogMiwKICAiaWQiOiB",
	expires_in: 2592000,
	token_type: "Bearer",
	scope: "eats.store eats.store.status.write eats.order eats.store.orders.read",
	refresh_token: "",
};

const ORDER_RESPONSE = {
	id: "9e28d27c-f7de-4a0e-b774-c7e3c8f11f89",
	display_id: "5AB7",
	store: { id: "store-abc-123", name: "Best Burgers" },
	eater: {
		first_name: "Jane",
		last_name: "Doe",
		phone: "+15555550101",
		phone_code: "US",
	},
	cart: {
		items: [
			{
				id: "item-001",
				title: "Classic Burger",
				quantity: 2,
				price: { unit_price: { amount: 1299, currency_code: "USD" } },
				selected_modifier_groups: [
					{
						id: "mod-group-1",
						title: "Toppings",
						selected_items: [
							{
								id: "mod-1",
								title: "Extra Cheese",
								quantity: 1,
								price: { unit_price: { amount: 150, currency_code: "USD" } },
							},
						],
					},
				],
				special_instructions: "No onions please",
			},
		],
		subtotal: 2748,
		delivery_fee: 499,
		tax: 247,
		total: 3494,
		currency_code: "USD",
		special_instructions: "Ring doorbell",
	},
	payment: { charges: { total: { amount: 3494, currency_code: "USD" } } },
	type: "DELIVERY_BY_UBER",
	estimated_ready_for_pickup_at: "2026-03-18T12:30:00Z",
	placed_at: "2026-03-18T12:00:00Z",
	current_state: "CREATED",
};

const CREATED_ORDERS_RESPONSE = {
	orders: [ORDER_RESPONSE],
};

const CANCELED_ORDERS_RESPONSE = {
	orders: [
		{
			order_id: "9e28d27c-f7de-4a0e-b774-c7e3c8f11f89",
			cancel_reason: "Store closed",
			cancelling_party: "MERCHANT",
		},
	],
};

const MENU_RESPONSE: UberEatsMenuPayload = {
	menus: [
		{
			id: "menu-1",
			title: { translations: { en: "Lunch Menu" } },
			category_ids: ["cat-1"],
			service_availability: [
				{
					day_of_week: "monday",
					time_periods: [{ start_time: "11:00", end_time: "15:00" }],
				},
			],
		},
	],
	categories: [
		{
			id: "cat-1",
			title: { translations: { en: "Burgers" } },
			entities: [{ id: "item-001", type: "ITEM" as const }],
		},
	],
	items: [
		{
			id: "item-001",
			title: { translations: { en: "Classic Burger" } },
			description: { translations: { en: "Half-pound beef patty" } },
			image_url: "https://cdn.example.com/burger.jpg",
			price_info: { price: 1299 },
			tax_info: { tax_rate: 0.09 },
			modifier_group_ids: { ids: ["mod-group-1"] },
		},
	],
	modifier_groups: [
		{
			id: "mod-group-1",
			title: { translations: { en: "Toppings" } },
			quantity_info: { quantity: { max_permitted: 5, min_permitted: 0 } },
			modifier_options: [{ id: "item-002", type: "ITEM" as const }],
		},
	],
};

const STORE_STATUS_RESPONSE = {
	status: "ONLINE",
};

// ── Test helpers ────────────────────────────────────────────────────────────

function mockFetchSequence(
	responses: Array<{ status: number; body: unknown }>,
) {
	let callIndex = 0;
	const calls: Array<[string, RequestInit | undefined]> = [];
	const fn = async (url: string | URL | Request, init?: RequestInit) => {
		const urlStr =
			typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
		calls.push([urlStr, init]);
		const resp = responses[callIndex] ?? responses[responses.length - 1];
		callIndex++;
		return {
			ok: resp.status >= 200 && resp.status < 300,
			status: resp.status,
			text: async () => JSON.stringify(resp.body),
			json: async () => resp.body,
		} as Response;
	};
	fn.calls = calls;
	return fn;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("UberEatsProvider", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function createProvider() {
		return new UberEatsProvider(
			"client-id-123",
			"client-secret-456",
			"store-abc-123",
		);
	}

	describe("verifyConnection", () => {
		it("returns ok with scopes on successful token exchange", async () => {
			const fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				scopes: [
					"eats.store",
					"eats.store.status.write",
					"eats.order",
					"eats.store.orders.read",
				],
			});
			expect(fetcher.calls).toHaveLength(1);
			expect(fetcher.calls[0][0]).toBe("https://auth.uber.com/oauth/v2/token");
		});

		it("returns error with Uber description on 401", async () => {
			globalThis.fetch = mockFetchSequence([
				{
					status: 401,
					body: {
						error: "invalid_client",
						error_description: "The client credentials are invalid",
					},
				},
			]);

			const provider = createProvider();
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "The client credentials are invalid",
			});
		});

		it("falls back to the OAuth error code when no description", async () => {
			globalThis.fetch = mockFetchSequence([
				{
					status: 400,
					body: { error: "invalid_grant" },
				},
			]);

			const provider = createProvider();
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "invalid_grant",
			});
		});

		it("returns error when fetch throws", async () => {
			globalThis.fetch = vi
				.fn()
				.mockRejectedValueOnce(
					new Error("ECONNREFUSED"),
				) as typeof globalThis.fetch;

			const provider = createProvider();
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "ECONNREFUSED",
			});
		});

		it("caches the token so subsequent API calls don't re-authenticate", async () => {
			const fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 200, body: ORDER_RESPONSE },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			const verify = await provider.verifyConnection();
			expect(verify.ok).toBe(true);

			await provider.getOrder("order-1");

			// Token exchange once + one API call
			expect(fetcher.calls).toHaveLength(2);
			expect(fetcher.calls[1][0]).toContain("/v1/eats/order/order-1");
		});
	});

	describe("authentication", () => {
		it("obtains an access token with client credentials", async () => {
			const fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 200, body: ORDER_RESPONSE },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			await provider.getOrder("order-1");

			expect(fetcher.calls).toHaveLength(2);
			const [authUrl, authOpts] = fetcher.calls[0];
			expect(authUrl).toBe("https://auth.uber.com/oauth/v2/token");
			expect(authOpts?.method).toBe("POST");
			const body = authOpts?.body as string;
			expect(body).toContain("client_id=client-id-123");
			expect(body).toContain("client_secret=client-secret-456");
			expect(body).toContain("grant_type=client_credentials");
		});

		it("reuses cached token for subsequent requests", async () => {
			const fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 200, body: ORDER_RESPONSE },
				{ status: 200, body: ORDER_RESPONSE },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			await provider.getOrder("order-1");
			await provider.getOrder("order-2");

			// Only 1 auth call + 2 API calls = 3 total
			expect(fetcher.calls).toHaveLength(3);
		});

		it("throws on auth failure", async () => {
			const fetcher = mockFetchSequence([
				{ status: 401, body: { error: "invalid_client" } },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			await expect(provider.getOrder("order-1")).rejects.toThrow(
				"Uber Eats auth failed",
			);
		});
	});

	describe("order endpoints", () => {
		let fetcher: ReturnType<typeof mockFetchSequence>;

		beforeEach(() => {
			fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 200, body: ORDER_RESPONSE },
			]);
			globalThis.fetch = fetcher;
		});

		it("fetches order details with correct URL", async () => {
			const provider = createProvider();
			const order = await provider.getOrder("order-abc");

			const [url] = fetcher.calls[1];
			expect(url).toBe("https://api.uber.com/v1/eats/order/order-abc");
			expect(order.id).toBe("9e28d27c-f7de-4a0e-b774-c7e3c8f11f89");
			expect(order.cart.items).toHaveLength(1);
			expect(order.eater.first_name).toBe("Jane");
		});

		it("fetches created orders", async () => {
			fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 200, body: CREATED_ORDERS_RESPONSE },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			const result = await provider.getCreatedOrders();

			expect(result.orders).toHaveLength(1);
			const [url] = fetcher.calls[1];
			expect(url).toBe(
				"https://api.uber.com/v1/eats/stores/store-abc-123/created-orders",
			);
		});

		it("fetches canceled orders", async () => {
			fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 200, body: CANCELED_ORDERS_RESPONSE },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			const result = await provider.getCanceledOrders();

			expect(result.orders).toHaveLength(1);
			expect(result.orders[0].cancel_reason).toBe("Store closed");
		});

		it("accepts an order", async () => {
			fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 204, body: "" },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			await provider.acceptOrder("order-abc", "Confirmed");

			const [url, opts] = fetcher.calls[1];
			expect(url).toBe(
				"https://api.uber.com/v1/eats/orders/order-abc/accept_pos_order",
			);
			expect(opts?.method).toBe("POST");
		});

		it("denies an order", async () => {
			fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 204, body: "" },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			await provider.denyOrder("order-abc", {
				explanation: "Out of burger buns",
				code: "ITEM_UNAVAILABLE",
			});

			const [url] = fetcher.calls[1];
			expect(url).toBe(
				"https://api.uber.com/v1/eats/orders/order-abc/deny_pos_order",
			);
		});

		it("cancels an order", async () => {
			fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 204, body: "" },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			await provider.cancelOrder(
				"order-abc",
				"Kitchen closed",
				"KITCHEN_CLOSED",
			);

			const [url, opts] = fetcher.calls[1];
			expect(url).toBe("https://api.uber.com/v1/eats/orders/order-abc/cancel");
			const body = JSON.parse(opts?.body as string);
			expect(body.cancelling_party).toBe("MERCHANT");
			expect(body.code).toBe("KITCHEN_CLOSED");
		});

		it("updates delivery status", async () => {
			fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 204, body: "" },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			await provider.updateDeliveryStatus("order-abc", "delivered");

			const [url] = fetcher.calls[1];
			expect(url).toBe(
				"https://api.uber.com/v1/eats/orders/order-abc/restaurantdelivery/status",
			);
		});
	});

	describe("menu endpoints", () => {
		it("retrieves the menu", async () => {
			const fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 200, body: MENU_RESPONSE },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			const menu = await provider.getMenu();

			expect(menu.menus).toHaveLength(1);
			expect(menu.categories).toHaveLength(1);
			expect(menu.items).toHaveLength(1);
			expect(menu.items[0].price_info.price).toBe(1299);

			const [url] = fetcher.calls[1];
			expect(url).toBe(
				"https://api.uber.com/v2/eats/stores/store-abc-123/menus",
			);
		});

		it("uploads a menu", async () => {
			const fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 204, body: "" },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			await provider.uploadMenu(MENU_RESPONSE);

			const [url, opts] = fetcher.calls[1];
			expect(url).toBe(
				"https://api.uber.com/v2/eats/stores/store-abc-123/menus",
			);
			expect(opts?.method).toBe("PUT");
		});

		it("updates a menu item", async () => {
			const fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 204, body: "" },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			await provider.updateMenuItem("item-001", {
				suspension_info: {
					suspension: {
						suspend_until: 9999999999,
						reason: "Out of stock",
					},
				},
			});

			const [url] = fetcher.calls[1];
			expect(url).toBe(
				"https://api.uber.com/v2/eats/stores/store-abc-123/menus/items/item-001",
			);
		});
	});

	describe("store endpoints", () => {
		it("fetches store status", async () => {
			const fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{ status: 200, body: STORE_STATUS_RESPONSE },
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			const status = await provider.getStoreStatus();

			expect(status.status).toBe("ONLINE");
		});
	});

	describe("error handling", () => {
		it("throws on API error with message", async () => {
			const fetcher = mockFetchSequence([
				{ status: 200, body: TOKEN_RESPONSE },
				{
					status: 404,
					body: { code: "NOT_FOUND", message: "Order not found" },
				},
			]);
			globalThis.fetch = fetcher;

			const provider = createProvider();
			await expect(provider.getOrder("bad-id")).rejects.toThrow(
				"Uber Eats API error: Order not found",
			);
		});

		it("includes HTTP status when error body is not JSON", async () => {
			let callIdx = 0;
			globalThis.fetch = (async () => {
				callIdx++;
				if (callIdx === 1) {
					return {
						ok: true,
						status: 200,
						text: async () => JSON.stringify(TOKEN_RESPONSE),
						json: async () => TOKEN_RESPONSE,
					} as unknown as Response;
				}
				return {
					ok: false,
					status: 500,
					text: async () => "Internal Server Error",
					json: async () => {
						throw new Error("not json");
					},
				} as unknown as Response;
			}) as unknown as typeof fetch;

			const provider = createProvider();
			await expect(provider.getOrder("x")).rejects.toThrow("HTTP 500");
		});
	});

	describe("webhook signature verification", () => {
		it("validates a correct HMAC-SHA256 signature", async () => {
			const body =
				'{"event_type":"orders.notification","meta":{"resource_id":"abc"}}';
			const secret = "my-client-secret";

			const encoder = new TextEncoder();
			const key = await crypto.subtle.importKey(
				"raw",
				encoder.encode(secret),
				{ name: "HMAC", hash: "SHA-256" },
				false,
				["sign"],
			);
			const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
			const hex = Array.from(new Uint8Array(sig))
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");

			const valid = await UberEatsProvider.verifyWebhookSignature(
				body,
				hex,
				secret,
			);
			expect(valid).toBe(true);
		});

		it("rejects an incorrect signature", async () => {
			const valid = await UberEatsProvider.verifyWebhookSignature(
				'{"test":true}',
				"0000000000000000000000000000000000000000000000000000000000000000",
				"secret",
			);
			expect(valid).toBe(false);
		});

		it("rejects a signature with wrong length", async () => {
			const valid = await UberEatsProvider.verifyWebhookSignature(
				'{"test":true}',
				"tooshort",
				"secret",
			);
			expect(valid).toBe(false);
		});
	});
});
