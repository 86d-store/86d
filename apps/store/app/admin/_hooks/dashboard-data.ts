import { type ZodType, z } from "@86d-app/core/zod";

const count = z.number().int().nonnegative();

export const countResponse = z.object({ total: count });
export const revenueResponse = z.object({
	summary: z.object({
		totalRevenue: z.number().finite(),
		averageOrderValue: z.number().finite(),
	}),
});
export const ordersResponse = z.object({
	orders: z.array(
		z.object({
			id: z.string(),
			orderNumber: z.string(),
			customerId: z.string().nullish(),
			guestEmail: z.string().nullish(),
			status: z.string(),
			total: z.number().finite(),
			currency: z.string().regex(/^[a-zA-Z]{3}$/),
			createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
		}),
	),
});
export const inventoryResponse = z.object({
	items: z.array(
		z.object({
			id: z.string(),
			productId: z.string(),
			productName: z.string().nullish(),
			variantName: z.string().nullish(),
			available: z.number().finite(),
		}),
	),
});

export interface DashboardIssue {
	title: string;
	description: string;
	action?: { href: string; label: string };
}

export type DashboardState<T> =
	| { status: "loading" }
	| { status: "error"; issue: DashboardIssue }
	| { status: "ready"; data: T };

export interface DashboardQuery {
	data: unknown;
	isPending: boolean;
	isError: boolean;
	error: unknown;
}

export function dashboardIssue(error: unknown): DashboardIssue {
	const status =
		typeof error === "object" && error !== null && "status" in error
			? error.status
			: undefined;
	if (status === 401) {
		return {
			title: "Sign in again to load your store",
			description:
				"Your session has expired. Sign in again, then refresh this page.",
			action: { href: "/auth/signin", label: "Sign in" },
		};
	}
	if (status === 403) {
		return {
			title: "Store access is required",
			description:
				"Ask a store owner or administrator for permission to view this information.",
		};
	}
	if (status === 502 || status === 503 || status === 504) {
		return {
			title: "Some store information is temporarily unavailable",
			description:
				"This overview could not load. Your store data has not been changed. Try again shortly.",
		};
	}
	return {
		title: "Some store information could not load",
		description:
			"Available information is shown below. Refresh to try the remaining requests again.",
	};
}

export function readDashboardState<T>(
	query: DashboardQuery,
	schema: ZodType<T>,
): DashboardState<T> {
	if (query.isPending) return { status: "loading" };
	if (query.isError)
		return { status: "error", issue: dashboardIssue(query.error) };
	const parsed = schema.safeParse(query.data);
	return parsed.success
		? { status: "ready", data: parsed.data }
		: { status: "error", issue: dashboardIssue(query.data) };
}

export function mapDashboardState<T, U>(
	state: DashboardState<T>,
	map: (data: T) => U,
): DashboardState<U> {
	return state.status === "ready"
		? { status: "ready", data: map(state.data) }
		: state;
}

export function combineDashboardState<A, B, T>(
	first: DashboardState<A>,
	second: DashboardState<B>,
	map: (first: A, second: B) => T,
): DashboardState<T> {
	if (first.status === "error") return first;
	if (second.status === "error") return second;
	if (first.status === "loading" || second.status === "loading") {
		return { status: "loading" };
	}
	return { status: "ready", data: map(first.data, second.data) };
}

export function formatDashboardMoney(cents: number, currency = "USD") {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

export function formatDashboardCount(value: number) {
	return new Intl.NumberFormat("en-US").format(value);
}

export function formatDashboardDate(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	}).format(new Date(value));
}

export type DashboardMetricId =
	| "revenue"
	| "orders"
	| "average"
	| "customers"
	| "pending"
	| "processing"
	| "products"
	| "reviews";

export interface DashboardMetric {
	id: DashboardMetricId;
	label: string;
	description: string;
	href: string;
	state: DashboardState<string>;
}

export interface DashboardOrder {
	id: string;
	href: string;
	number: string;
	customer: string;
	status: string;
	total: string;
	date: string;
}

export interface DashboardStockItem {
	id: string;
	href: string;
	name: string;
	variant: string | null | undefined;
	available: string;
	outOfStock: boolean;
}

export interface DashboardViewModel {
	metrics: DashboardMetric[];
	operations: DashboardMetric[];
	orders: DashboardState<DashboardOrder[]>;
	stock: DashboardState<{
		items: DashboardStockItem[];
		remaining: string | null;
	}>;
	issues: DashboardIssue[];
}

export function createDashboardLoading(): DashboardViewModel {
	const loading: DashboardState<string> = { status: "loading" };
	return {
		metrics: [
			{
				id: "revenue",
				label: "Total revenue",
				description: "Recorded sales · USD",
				href: "/admin/analytics",
				state: loading,
			},
			{
				id: "orders",
				label: "Orders",
				description: "All orders",
				href: "/admin/orders",
				state: loading,
			},
			{
				id: "average",
				label: "Average order",
				description: "Recorded sales · USD",
				href: "/admin/analytics",
				state: loading,
			},
			{
				id: "customers",
				label: "Customers",
				description: "Your customer directory",
				href: "/admin/customers",
				state: loading,
			},
		],
		operations: [
			{
				id: "pending",
				label: "Pending orders",
				description: "Awaiting your next step",
				href: "/admin/orders",
				state: loading,
			},
			{
				id: "processing",
				label: "Processing",
				description: "Orders in progress",
				href: "/admin/orders",
				state: loading,
			},
			{
				id: "products",
				label: "Active products",
				description: "Active / total products",
				href: "/admin/products",
				state: loading,
			},
			{
				id: "reviews",
				label: "Pending reviews",
				description: "Ready for moderation",
				href: "/admin/reviews",
				state: loading,
			},
		],
		orders: { status: "loading" },
		stock: { status: "loading" },
		issues: [],
	};
}
