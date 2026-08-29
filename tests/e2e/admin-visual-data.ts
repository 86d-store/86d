import type { AdminVisualEndpointPath } from "./admin-visual-api-contract";

type AdminVisualResponder = (url: URL) => Record<string, unknown>;

const ADMIN_VISUAL_ORDER = {
	id: "order_visual_001",
	orderNumber: "VISUAL-001",
	guestEmail: "shopper@example.com",
	status: "completed",
	paymentStatus: "paid",
	total: 89303,
	currency: "USD",
	createdAt: "2026-08-24T12:00:00.000Z",
};

const ADMIN_VISUAL_GIFT_CARDS = [
	{
		id: "gift_card_visual_001",
		code: "GIFT-VISUAL-ALPHA-2026-0001",
		initialBalance: 25_000,
		currentBalance: 18_750,
		currency: "USD",
		status: "active",
		recipientEmail: "long.visual.recipient@example.com",
		note: "Legacy launch reward",
		createdAt: "2026-07-15T12:00:00.000Z",
		expiresAt: "2027-07-15T12:00:00.000Z",
	},
	{
		id: "gift_card_visual_002",
		code: "GIFT-VISUAL-BETA-2026-0002",
		initialBalance: 10_000,
		currentBalance: 0,
		currency: "USD",
		status: "depleted",
		recipientEmail: "second.visual.recipient@example.com",
		createdAt: "2026-06-01T12:00:00.000Z",
	},
];

const ADMIN_VISUAL_RESPONDERS: Record<
	AdminVisualEndpointPath,
	AdminVisualResponder
> = {
	"/api/admin/orders": (url) => {
		const orders = url.searchParams.has("status") ? [] : [ADMIN_VISUAL_ORDER];
		return {
			orders,
			total: orders.length,
			page: 1,
			limit: Number(url.searchParams.get("limit") ?? 20),
			pages: 1,
		};
	},
	"/api/admin/customers": (url) => ({
		customers: [
			{
				id: "customer_visual_001",
				email: "visual@example.com",
				firstName: "Visual",
				lastName: "Shopper",
				tags: ["repeat"],
				createdAt: "2026-08-24T12:00:00.000Z",
			},
		],
		total: 1,
		page: 1,
		limit: Number(url.searchParams.get("limit") ?? 20),
		pages: 1,
	}),
	"/api/admin/customers/tags": () => ({
		tags: [{ tag: "repeat", count: 1 }],
	}),
	"/api/admin/inventory/low-stock": () => ({
		items: [
			{
				id: "inventory_visual_001",
				productId: "product_visual_001",
				productName: "House Blend Coffee",
				quantity: 2,
				reserved: 0,
				available: 2,
			},
		],
	}),
	"/api/admin/reviews": () => ({ reviews: [], total: 0 }),
	"/api/admin/analytics/stats": () => ({ stats: [] }),
	"/api/admin/analytics/top-products": () => ({ products: [] }),
	"/api/admin/revenue/stats": () => ({
		totalVolume: 0,
		transactionCount: 0,
		averageValue: 0,
		currency: "USD",
		byStatus: {
			pending: 0,
			processing: 0,
			succeeded: 0,
			failed: 0,
			cancelled: 0,
			refunded: 0,
		},
		refundVolume: 0,
		refundCount: 0,
	}),
	"/api/admin/gift-cards": () => ({
		cards: ADMIN_VISUAL_GIFT_CARDS,
		total: ADMIN_VISUAL_GIFT_CARDS.length,
	}),
	"/api/admin/gift-cards/stats": () => ({
		stats: {
			totalIssued: 2,
			totalActive: 1,
			totalDepleted: 1,
			totalDisabled: 0,
			totalExpired: 0,
			totalIssuedValue: 35_000,
			totalCurrentBalance: 18_750,
			currency: "USD",
		},
	}),
	"/api/admin/checkout/sessions": () => ({
		sessions: [],
		total: 0,
		page: 1,
		limit: 20,
		pages: 1,
	}),
	"/api/admin/checkout/stats": () => ({
		total: 0,
		pending: 0,
		processing: 0,
		completed: 0,
		abandoned: 0,
		expired: 0,
		conversionRate: 0,
		totalRevenue: 0,
		averageOrderValue: 0,
	}),
	"/api/admin/blog": () => ({ posts: [], total: 0 }),
	"/api/admin/collections": () => ({ collections: [], total: 0 }),
	"/api/admin/collections/stats": () => ({
		stats: {
			totalCollections: 0,
			activeCollections: 0,
			featuredCollections: 0,
			manualCollections: 0,
			automaticCollections: 0,
			totalProducts: 0,
		},
	}),
	"/api/admin/media": () => ({ assets: [], total: 0 }),
	"/api/admin/media/folders": () => ({ folders: [] }),
	"/api/admin/newsletter": () => ({ subscribers: [], total: 0 }),
	"/api/admin/pages": () => ({ pages: [], total: 0 }),
	"/api/admin/payments": () => ({ intents: [], total: 0 }),
	"/api/admin/notifications": () => ({ notifications: [], total: 0 }),
	"/api/admin/notifications/stats": () => ({
		stats: { total: 0, unread: 0, byType: {} },
	}),
	"/api/admin/sitemap/config": () => ({
		config: {
			baseUrl: "https://visual.example",
			includeProducts: true,
			includeCollections: true,
			includePages: true,
			includeBlog: true,
			includeBrands: true,
		},
	}),
	"/api/admin/sitemap/stats": () => ({
		stats: { totalEntries: 0, entriesBySource: {} },
	}),
	"/api/admin/sitemap/entries": () => ({ entries: [], total: 0 }),
	"/api/admin/carts": () => ({
		carts: [],
		page: 1,
		limit: 20,
		total: 0,
	}),
	"/api/admin/abandoned-carts": () => ({ carts: [], total: 0 }),
	"/api/admin/abandoned-carts/stats": () => ({
		stats: {
			totalAbandoned: 0,
			totalRecovered: 0,
			totalExpired: 0,
			totalDismissed: 0,
			recoveryRate: 0,
			totalRecoveredValue: 0,
		},
	}),
};

const ADMIN_VISUAL_RESPONDER_BY_PATH = new Map<string, AdminVisualResponder>(
	Object.entries(ADMIN_VISUAL_RESPONDERS),
);

export const DETERMINISTIC_ADMIN_VISUAL_ENDPOINT_PATHS = Object.keys(
	ADMIN_VISUAL_RESPONDERS,
).toSorted();

export function getDeterministicAdminVisualResponse(
	path: string,
	url: URL,
): Record<string, unknown> | undefined {
	return ADMIN_VISUAL_RESPONDER_BY_PATH.get(path)?.(url);
}
