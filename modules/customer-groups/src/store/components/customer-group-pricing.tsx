"use client";

import { useCustomerGroupApi } from "./_hooks";
import CustomerGroupPricingTemplate from "./customer-group-pricing.mdx";

interface PriceAdjustment {
	id: string;
	groupId: string;
	adjustmentType: "percentage" | "fixed";
	value: number;
	scope: "all" | "category" | "product";
	scopeId?: string | undefined;
}

function formatAdjustment(adj: PriceAdjustment): string {
	if (adj.adjustmentType === "percentage") {
		const sign = adj.value >= 0 ? "+" : "";
		return `${sign}${adj.value}%`;
	}
	const absVal = Math.abs(adj.value / 100).toFixed(2);
	return adj.value >= 0 ? `+$${absVal}` : `-$${absVal}`;
}

function scopeLabel(scope: PriceAdjustment["scope"]): string {
	switch (scope) {
		case "all":
			return "All products";
		case "category":
			return "Category";
		case "product":
			return "Product";
		default:
			return "All products";
	}
}

export function CustomerGroupPricing() {
	const api = useCustomerGroupApi();

	const { data, isLoading, isError } = api.myPricing.useQuery({}) as {
		data: { adjustments: PriceAdjustment[] } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	if (isLoading) {
		return (
			<div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800">
				<div className="animate-pulse space-y-3">
					<div className="h-4 w-32 rounded bg-muted dark:bg-muted" />
					<div className="h-12 w-full rounded-lg bg-muted dark:bg-muted" />
					<div className="h-12 w-full rounded-lg bg-muted dark:bg-muted" />
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/30 dark:bg-red-900/10">
				<p className="text-red-600 text-sm dark:text-red-400">
					Unable to load your pricing information. Please try again later.
				</p>
			</div>
		);
	}

	const adjustments = data?.adjustments ?? [];

	if (adjustments.length === 0) {
		return (
			<div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800">
				<p className="text-muted-foreground text-sm">
					No special pricing is available for your account.
				</p>
			</div>
		);
	}

	const rows = adjustments.map((adj) => ({
		id: adj.id,
		label: formatAdjustment(adj),
		scope: scopeLabel(adj.scope),
		isDiscount: adj.value < 0,
		isPremium: adj.value > 0,
	}));

	return (
		<CustomerGroupPricingTemplate rows={rows} count={adjustments.length} />
	);
}
