"use client";

import { useModuleClient } from "@86d-store/core/client/provider";
import {
	combineDashboardState,
	countResponse,
	createDashboardLoading,
	type DashboardIssue,
	type DashboardMetricId,
	type DashboardState,
	type DashboardViewModel,
	formatDashboardCount,
	formatDashboardDate,
	formatDashboardMoney,
	inventoryResponse,
	mapDashboardState,
	ordersResponse,
	readDashboardState,
	revenueResponse,
} from "./dashboard-data";

export function useDashboard() {
	const client = useModuleClient();
	const ordersApi = client.module("orders").admin["/admin/orders"];
	const productsApi = client.module("products").admin["/admin/products/list"];
	const revenueQuery = client
		.module("analytics")
		.admin["/admin/analytics/revenue"].useQuery({});
	const ordersQuery = ordersApi.useQuery({ limit: "1" });
	const pendingQuery = ordersApi.useQuery({ limit: "1", status: "pending" });
	const processingQuery = ordersApi.useQuery({
		limit: "1",
		status: "processing",
	});
	const recentQuery = ordersApi.useQuery({ limit: "5" });
	const customersQuery = client
		.module("customers")
		.admin["/admin/customers"].useQuery({ limit: "1" });
	const productsQuery = productsApi.useQuery({ limit: "1" });
	const activeProductsQuery = productsApi.useQuery({
		limit: "1",
		status: "active",
	});
	const stockQuery = client
		.module("inventory")
		.admin["/admin/inventory/low-stock"].useQuery({});
	const reviewsQuery = client
		.module("reviews")
		.admin["/admin/reviews"].useQuery({ status: "pending", take: "1" });
	const revenue = readDashboardState(revenueQuery, revenueResponse);
	const states: Record<DashboardMetricId, DashboardState<string>> = {
		revenue: mapDashboardState(revenue, ({ summary }) =>
			formatDashboardMoney(summary.totalRevenue),
		),
		average: mapDashboardState(revenue, ({ summary }) =>
			formatDashboardMoney(summary.averageOrderValue),
		),
		orders: mapDashboardState(
			readDashboardState(ordersQuery, countResponse),
			({ total }) => formatDashboardCount(total),
		),
		customers: mapDashboardState(
			readDashboardState(customersQuery, countResponse),
			({ total }) => formatDashboardCount(total),
		),
		pending: mapDashboardState(
			readDashboardState(pendingQuery, countResponse),
			({ total }) => formatDashboardCount(total),
		),
		processing: mapDashboardState(
			readDashboardState(processingQuery, countResponse),
			({ total }) => formatDashboardCount(total),
		),
		products: combineDashboardState(
			readDashboardState(activeProductsQuery, countResponse),
			readDashboardState(productsQuery, countResponse),
			(active, all) =>
				`${formatDashboardCount(active.total)} / ${formatDashboardCount(all.total)}`,
		),
		reviews: mapDashboardState(
			readDashboardState(reviewsQuery, countResponse),
			({ total }) => formatDashboardCount(total),
		),
	};
	const orders = mapDashboardState(
		readDashboardState(recentQuery, ordersResponse),
		({ orders: records }) =>
			records.map((order) => ({
				id: order.id,
				href: `/admin/orders/${encodeURIComponent(order.id)}`,
				number: `#${order.orderNumber}`,
				customer:
					order.guestEmail ?? (order.customerId != null ? "Customer" : "Guest"),
				status: order.status,
				total: formatDashboardMoney(order.total, order.currency),
				date: formatDashboardDate(order.createdAt),
			})),
	);
	const stock = mapDashboardState(
		readDashboardState(stockQuery, inventoryResponse),
		({ items }) => ({
			items: items.slice(0, 5).map((item) => ({
				id: item.id,
				href: `/admin/products/${encodeURIComponent(item.productId)}`,
				name: item.productName ?? "Product",
				variant: item.variantName,
				available: `${formatDashboardCount(item.available)} available`,
				outOfStock: item.available <= 0,
			})),
			remaining:
				items.length > 5
					? `${formatDashboardCount(items.length - 5)} more items in inventory`
					: null,
		}),
	);
	const issues = new Map<string, DashboardIssue>();
	for (const state of [...Object.values(states), orders, stock]) {
		if (state.status === "error") issues.set(state.issue.title, state.issue);
	}
	const initial = createDashboardLoading();
	const model: DashboardViewModel = {
		metrics: initial.metrics.map((metric) => ({
			...metric,
			state: states[metric.id],
		})),
		operations: initial.operations.map((metric) => ({
			...metric,
			state: states[metric.id],
		})),
		orders,
		stock,
		issues: [...issues.values()],
	};
	const queries = [
		revenueQuery,
		ordersQuery,
		pendingQuery,
		processingQuery,
		recentQuery,
		customersQuery,
		productsQuery,
		activeProductsQuery,
		stockQuery,
		reviewsQuery,
	];
	const isRefreshing = queries.some((query) => query.isFetching);

	function handleRefresh() {
		void Promise.allSettled(queries.map((query) => query.refetch()));
	}

	return { model, isRefreshing, onRefresh: handleRefresh };
}
