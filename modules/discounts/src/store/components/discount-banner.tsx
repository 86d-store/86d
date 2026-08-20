"use client";

import { useDiscountsApi } from "./_hooks";
import { formatDiscountValue } from "./_utils";
import DiscountBannerTemplate from "./discount-banner.mdx";

interface Promotion {
	id: string;
	name: string;
	description?: string | undefined;
	type: string;
	value: number;
	minimumAmount?: number | undefined;
	endsAt?: string | undefined;
}

export function DiscountBanner({ limit = 3 }: { limit?: number | undefined }) {
	const api = useDiscountsApi();

	const { data, isLoading: loading } = api.active.useQuery() as {
		data: { promotions: Promotion[] } | undefined;
		isLoading: boolean;
	};

	if (loading) return null;

	const promotions = data?.promotions?.slice(0, limit) ?? [];
	if (promotions.length === 0) return null;

	const items = promotions.map((p) => ({
		id: p.id,
		name: p.name,
		description: p.description,
		badge: formatDiscountValue(p.type, p.value),
		hasMinimum: p.minimumAmount != null && p.minimumAmount > 0,
		minimumFormatted: p.minimumAmount ? formatCentsLocal(p.minimumAmount) : "",
		hasExpiry: p.endsAt != null,
		expiryFormatted: p.endsAt ? formatExpiry(p.endsAt) : "",
	}));

	return <DiscountBannerTemplate items={items} />;
}

function formatCentsLocal(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function formatExpiry(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = date.getTime() - now.getTime();
	const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays <= 0) return "Ending soon";
	if (diffDays === 1) return "Ends tomorrow";
	if (diffDays <= 7) return `Ends in ${diffDays} days`;
	return `Ends ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
