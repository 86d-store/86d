"use client";

import StockBadgeTemplate from "./stock-badge.mdx";

export interface StockBadgeProps {
	inventory: number;
}

export function StockBadge({ inventory }: StockBadgeProps) {
	const status = inventory <= 0 ? "out" : inventory <= 5 ? "low" : "in";
	const label =
		inventory <= 0
			? "Out of stock"
			: inventory <= 5
				? `Only ${inventory} left`
				: "In stock";

	return <StockBadgeTemplate status={status} label={label} />;
}
