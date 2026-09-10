"use client";

import { useState } from "react";
import { DashboardView } from "../../../admin/_components/dashboard-view";
import {
	createDashboardLoading,
	type DashboardMetricId,
	type DashboardOrder,
	type DashboardStockItem,
	type DashboardViewModel,
	dashboardIssue,
} from "../../../admin/_hooks/dashboard-data";

const values: Record<DashboardMetricId, string> = {
	revenue: "$48,290.00",
	orders: "1,284",
	average: "$37.61",
	customers: "862",
	pending: "12",
	processing: "8",
	products: "46 / 52",
	reviews: "6",
};

const orders: DashboardOrder[] = [
	{
		id: "order-one",
		href: "/admin/orders/order-one",
		number: "#ORDER-2026-SEP-0000000001049",
		customer: "alex.morgan.with.a.long.email@example.com",
		status: "processing",
		total: "€1,234.56",
		date: "Sep 8",
	},
	{
		id: "order-two",
		href: "/admin/orders/order-two",
		number: "#1048",
		customer: "Customer",
		status: "pending",
		total: "£84.00",
		date: "Sep 8",
	},
	{
		id: "order-three",
		href: "/admin/orders/order-three",
		number: "#1047",
		customer: "taylor@example.com",
		status: "completed",
		total: "$128.50",
		date: "Sep 7",
	},
	{
		id: "order-four",
		href: "/admin/orders/order-four",
		number: "#1046",
		customer: "Guest",
		status: "on_hold",
		total: "$48.00",
		date: "Sep 7",
	},
];

const stock: DashboardStockItem[] = [
	{
		id: "stock-one",
		href: "/admin/products/product-one",
		name: "Handmade ceramic serving bowl with a long product name",
		variant: "Warm sand · Large",
		available: "0 available",
		outOfStock: true,
	},
	{
		id: "stock-two",
		href: "/admin/products/product-two",
		name: "Linen napkin set",
		variant: "Natural",
		available: "3 available",
		outOfStock: false,
	},
	{
		id: "stock-three",
		href: "/admin/products/product-three",
		name: "Everyday tumbler",
		variant: null,
		available: "5 available",
		outOfStock: false,
	},
];

function createDashboardFixture(
	state: string | null | undefined,
): DashboardViewModel {
	const model = createDashboardLoading();
	if (state === "loading") return model;
	const empty = state === "empty";
	const issue =
		state === "permission"
			? dashboardIssue({ status: 403 })
			: state === "unavailable"
				? dashboardIssue({ status: 503 })
				: state === "error"
					? dashboardIssue(undefined)
					: null;
	return {
		metrics: model.metrics.map((metric) => ({
			...metric,
			state:
				issue &&
				(state !== "error" ||
					metric.id === "revenue" ||
					metric.id === "average")
					? { status: "error", issue }
					: {
							status: "ready",
							data: empty
								? metric.id === "revenue" || metric.id === "average"
									? "$0.00"
									: "0"
								: values[metric.id],
						},
		})),
		operations: model.operations.map((metric) => ({
			...metric,
			state:
				issue && state !== "error"
					? { status: "error", issue }
					: {
							status: "ready",
							data: empty
								? metric.id === "products"
									? "0 / 0"
									: "0"
								: values[metric.id],
						},
		})),
		orders: issue
			? { status: "error", issue }
			: { status: "ready", data: empty ? [] : orders },
		stock: issue
			? { status: "error", issue }
			: {
					status: "ready",
					data: {
						items: empty ? [] : stock,
						remaining: empty ? null : "2 more items in inventory",
					},
				},
		issues: issue ? [issue] : [],
	};
}

export interface DashboardFixtureProps {
	state?: string | null;
}

export function DashboardFixture({ state }: DashboardFixtureProps) {
	const [recovered, setRecovered] = useState(false);
	const visibleState = recovered ? "loaded" : state;
	const model = createDashboardFixture(visibleState);

	function handleRefresh() {
		setRecovered(true);
	}

	return (
		<DashboardView
			model={model}
			isRefreshing={visibleState === "loading"}
			onRefresh={handleRefresh}
		/>
	);
}
