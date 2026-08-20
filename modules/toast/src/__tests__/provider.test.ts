import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastPosProvider } from "../provider";

describe("ToastPosProvider", () => {
	const originalFetch = globalThis.fetch;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		globalThis.fetch = mockFetch as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function makeProvider(opts?: { sandbox?: boolean }) {
		return new ToastPosProvider("test-token", "rest-guid-123", opts);
	}

	function mockJsonResponse(data: unknown, status = 200) {
		mockFetch.mockResolvedValueOnce({
			ok: status >= 200 && status < 300,
			status,
			text: async () => JSON.stringify(data),
			json: async () => data,
		});
	}

	function mockErrorResponse(status: number, message: string) {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status,
			text: async () => JSON.stringify({ status, message }),
			json: async () => ({ status, message }),
		});
	}

	// ── Auth & base URL ───────────────────────────────────────────────────

	describe("authentication", () => {
		it("sends Bearer token and restaurant GUID header", async () => {
			mockJsonResponse([]);
			const provider = makeProvider();
			await provider.getMenus();

			const [, options] = mockFetch.mock.calls[0];
			expect(options.headers.Authorization).toBe("Bearer test-token");
			expect(options.headers["Toast-Restaurant-External-ID"]).toBe(
				"rest-guid-123",
			);
		});

		it("uses sandbox URL by default", async () => {
			mockJsonResponse([]);
			const provider = makeProvider();
			await provider.getMenus();

			const [url] = mockFetch.mock.calls[0];
			expect(url).toContain("ws-sandbox-api.toasttab.com");
		});

		it("uses production URL when sandbox=false", async () => {
			mockJsonResponse([]);
			const provider = makeProvider({ sandbox: false });
			await provider.getMenus();

			const [url] = mockFetch.mock.calls[0];
			expect(url).toContain("ws-api.toasttab.com");
		});
	});

	// ── Menu endpoints ────────────────────────────────────────────────────

	describe("getMenus", () => {
		it("returns menus array", async () => {
			const menus = [
				{
					guid: "menu-1",
					name: "Lunch",
					menuGroups: [
						{
							guid: "grp-1",
							name: "Appetizers",
							menuItems: [{ guid: "item-1", name: "Wings", price: 12.99 }],
						},
					],
				},
			];
			mockJsonResponse(menus);

			const provider = makeProvider();
			const result = await provider.getMenus();

			expect(result).toEqual(menus);
			const [url] = mockFetch.mock.calls[0];
			expect(url).toContain("/menus/v2/menus");
		});

		it("returns empty array on empty response", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				text: async () => "",
			});

			const provider = makeProvider();
			const result = await provider.getMenus();
			expect(result).toEqual([]);
		});
	});

	describe("getMenuItem", () => {
		it("fetches a single menu item by GUID", async () => {
			const item = {
				guid: "item-1",
				name: "Cheeseburger",
				price: 14.99,
				visibility: "ALL",
			};
			mockJsonResponse(item);

			const provider = makeProvider();
			const result = await provider.getMenuItem("item-1");

			expect(result).toEqual(item);
			const [url] = mockFetch.mock.calls[0];
			expect(url).toContain("/menus/v2/menuItems/item-1");
		});
	});

	// ── Order endpoints ───────────────────────────────────────────────────

	describe("getOrders", () => {
		it("fetches orders with date range", async () => {
			const orders = [
				{
					guid: "ord-1",
					displayNumber: "1001",
					totalAmount: 42.5,
					checks: [],
					createdDate: "2025-01-15T12:00:00Z",
					modifiedDate: "2025-01-15T12:05:00Z",
				},
			];
			mockJsonResponse(orders);

			const provider = makeProvider();
			const result = await provider.getOrders({
				startDate: "2025-01-15T00:00:00Z",
				endDate: "2025-01-15T23:59:59Z",
			});

			expect(result.orders).toEqual(orders);
			const [url] = mockFetch.mock.calls[0];
			expect(url).toContain("/orders/v2/orders?");
			expect(url).toContain("startDate=");
			expect(url).toContain("endDate=");
		});
	});

	describe("getOrder", () => {
		it("fetches a single order by GUID", async () => {
			const order = {
				guid: "ord-1",
				displayNumber: "1001",
				totalAmount: 55.0,
				checks: [],
				createdDate: "2025-01-15T12:00:00Z",
				modifiedDate: "2025-01-15T12:05:00Z",
			};
			mockJsonResponse(order);

			const provider = makeProvider();
			const result = await provider.getOrder("ord-1");

			expect(result).toEqual(order);
			const [url] = mockFetch.mock.calls[0];
			expect(url).toContain("/orders/v2/orders/ord-1");
		});
	});

	// ── Stock endpoints ──────────────────────────────────────────────────

	describe("getInventory", () => {
		it("returns stock items", async () => {
			const items = [
				{
					guid: "stock-1",
					menuItemGuid: "item-1",
					quantity: 25,
					status: "QUANTITY",
				},
			];
			mockJsonResponse(items);

			const provider = makeProvider();
			const result = await provider.getInventory();
			expect(result).toEqual(items);
		});
	});

	describe("updateStock", () => {
		it("sends stock update payload", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				text: async () => "",
			});

			const provider = makeProvider();
			await provider.updateStock([
				{ menuItemGuid: "item-1", quantity: 10, status: "QUANTITY" },
				{ menuItemGuid: "item-2", status: "OUT_OF_STOCK" },
			]);

			const [url, options] = mockFetch.mock.calls[0];
			expect(url).toContain("/stock/v1/inventory");
			expect(options.method).toBe("POST");
			const body = JSON.parse(options.body);
			expect(body).toHaveLength(2);
			expect(body[0].menuItemGuid).toBe("item-1");
		});
	});

	// ── Error handling ──────────────────────────────────────────────────

	describe("error handling", () => {
		it("throws on API error with message", async () => {
			mockErrorResponse(401, "Authentication failed");

			const provider = makeProvider();
			await expect(provider.getMenus()).rejects.toThrow(
				"Toast API error: Authentication failed",
			);
		});

		it("throws with HTTP status on non-JSON error", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 503,
				text: async () => "Service Unavailable",
				json: () => {
					throw new Error("not json");
				},
			});

			const provider = makeProvider();
			await expect(provider.getMenus()).rejects.toThrow(
				"Toast API error: HTTP 503",
			);
		});
	});
});
