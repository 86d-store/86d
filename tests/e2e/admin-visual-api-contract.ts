export type AdminVisualEnvelopeValueKind =
	| "array"
	| "number"
	| "object"
	| "string";

type SuccessfulAdminVisualEndpointContract = {
	path: `/api/admin/${string}`;
	requestPath: `/api/admin/${string}`;
	expected: {
		kind: "success";
		fields: Readonly<Record<string, AdminVisualEnvelopeValueKind>>;
	};
};

type UnavailableAdminVisualEndpointContract = {
	path: `/api/admin/${string}`;
	requestPath: `/api/admin/${string}`;
	expected: {
		kind: "unavailable";
		code: string;
		error: string;
		status: number;
	};
};

export type AdminVisualEndpointContract =
	| SuccessfulAdminVisualEndpointContract
	| UnavailableAdminVisualEndpointContract;

export const ADMIN_VISUAL_ENDPOINT_CONTRACTS = [
	{
		path: "/api/admin/orders",
		requestPath: "/api/admin/orders?page=1&limit=1",
		expected: {
			kind: "success",
			fields: {
				orders: "array",
				total: "number",
				page: "number",
				limit: "number",
				pages: "number",
			},
		},
	},
	{
		path: "/api/admin/customers",
		requestPath: "/api/admin/customers?page=1&limit=1",
		expected: {
			kind: "success",
			fields: {
				customers: "array",
				total: "number",
				page: "number",
				limit: "number",
				pages: "number",
			},
		},
	},
	{
		path: "/api/admin/customers/tags",
		requestPath: "/api/admin/customers/tags",
		expected: { kind: "success", fields: { tags: "array" } },
	},
	{
		path: "/api/admin/inventory/low-stock",
		requestPath: "/api/admin/inventory/low-stock",
		expected: { kind: "success", fields: { items: "array" } },
	},
	{
		path: "/api/admin/reviews",
		requestPath: "/api/admin/reviews?take=1&skip=0",
		expected: {
			kind: "success",
			fields: { reviews: "array", total: "number" },
		},
	},
	{
		path: "/api/admin/analytics/stats",
		requestPath: "/api/admin/analytics/stats",
		expected: { kind: "success", fields: { stats: "array" } },
	},
	{
		path: "/api/admin/analytics/top-products",
		requestPath: "/api/admin/analytics/top-products?limit=1",
		expected: { kind: "success", fields: { products: "array" } },
	},
	{
		path: "/api/admin/revenue/stats",
		requestPath:
			"/api/admin/revenue/stats?from=2026-07-26T12%3A00%3A00.000Z&to=2026-08-25T12%3A00%3A00.000Z",
		expected: {
			kind: "unavailable",
			code: "REVENUE_SOURCE_UNAVAILABLE",
			error: "Authoritative revenue statistics are unavailable.",
			status: 503,
		},
	},
	{
		path: "/api/admin/gift-cards",
		requestPath: "/api/admin/gift-cards?take=1&skip=0",
		expected: {
			kind: "success",
			fields: { cards: "array", total: "number" },
		},
	},
	{
		path: "/api/admin/gift-cards/stats",
		requestPath: "/api/admin/gift-cards/stats",
		expected: { kind: "success", fields: { stats: "object" } },
	},
	{
		path: "/api/admin/checkout/sessions",
		requestPath: "/api/admin/checkout/sessions?page=1&limit=1",
		expected: {
			kind: "success",
			fields: {
				sessions: "array",
				total: "number",
				page: "number",
				limit: "number",
				pages: "number",
			},
		},
	},
	{
		path: "/api/admin/checkout/stats",
		requestPath: "/api/admin/checkout/stats",
		expected: {
			kind: "success",
			fields: {
				total: "number",
				pending: "number",
				processing: "number",
				completed: "number",
				abandoned: "number",
				expired: "number",
				conversionRate: "number",
				totalRevenue: "number",
				averageOrderValue: "number",
			},
		},
	},
	{
		path: "/api/admin/blog",
		requestPath: "/api/admin/blog?take=1&skip=0",
		expected: {
			kind: "success",
			fields: { posts: "array", total: "number" },
		},
	},
	{
		path: "/api/admin/collections",
		requestPath: "/api/admin/collections?take=1&skip=0",
		expected: {
			kind: "success",
			fields: { collections: "array", total: "number" },
		},
	},
	{
		path: "/api/admin/collections/stats",
		requestPath: "/api/admin/collections/stats",
		expected: { kind: "success", fields: { stats: "object" } },
	},
	{
		path: "/api/admin/media",
		requestPath: "/api/admin/media?take=1&skip=0",
		expected: {
			kind: "success",
			fields: { assets: "array", total: "number" },
		},
	},
	{
		path: "/api/admin/media/folders",
		requestPath: "/api/admin/media/folders",
		expected: { kind: "success", fields: { folders: "array" } },
	},
	{
		path: "/api/admin/newsletter",
		requestPath: "/api/admin/newsletter?take=1&skip=0",
		expected: {
			kind: "success",
			fields: { subscribers: "array", total: "number" },
		},
	},
	{
		path: "/api/admin/pages",
		requestPath: "/api/admin/pages?take=1&skip=0",
		expected: {
			kind: "success",
			fields: { pages: "array", total: "number" },
		},
	},
	{
		path: "/api/admin/payments",
		requestPath: "/api/admin/payments?take=1&skip=0",
		expected: {
			kind: "success",
			fields: { intents: "array", total: "number" },
		},
	},
	{
		path: "/api/admin/notifications",
		requestPath: "/api/admin/notifications?take=1&skip=0",
		expected: {
			kind: "success",
			fields: { notifications: "array", total: "number" },
		},
	},
	{
		path: "/api/admin/notifications/stats",
		requestPath: "/api/admin/notifications/stats",
		expected: { kind: "success", fields: { stats: "object" } },
	},
	{
		path: "/api/admin/sitemap/config",
		requestPath: "/api/admin/sitemap/config",
		expected: { kind: "success", fields: { config: "object" } },
	},
	{
		path: "/api/admin/sitemap/stats",
		requestPath: "/api/admin/sitemap/stats",
		expected: { kind: "success", fields: { stats: "object" } },
	},
	{
		path: "/api/admin/sitemap/entries",
		requestPath: "/api/admin/sitemap/entries?take=1&skip=0",
		expected: {
			kind: "success",
			fields: { entries: "array", total: "number" },
		},
	},
	{
		path: "/api/admin/carts",
		requestPath: "/api/admin/carts?page=1&limit=1",
		expected: {
			kind: "success",
			fields: {
				carts: "array",
				page: "number",
				limit: "number",
				total: "number",
			},
		},
	},
	{
		path: "/api/admin/abandoned-carts",
		requestPath: "/api/admin/abandoned-carts?take=1&skip=0",
		expected: {
			kind: "success",
			fields: { carts: "array", total: "number" },
		},
	},
	{
		path: "/api/admin/abandoned-carts/stats",
		requestPath: "/api/admin/abandoned-carts/stats",
		expected: { kind: "success", fields: { stats: "object" } },
	},
] as const satisfies readonly AdminVisualEndpointContract[];

export type AdminVisualEndpointPath =
	(typeof ADMIN_VISUAL_ENDPOINT_CONTRACTS)[number]["path"];
