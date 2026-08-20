"use client";

import { useSocialProofApi } from "./_hooks";
import { timeAgo } from "./_utils";
import RecentPurchasesTemplate from "./recent-purchases.mdx";

interface EventData {
	id: string;
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string;
	eventType: string;
	region?: string;
	city?: string;
	country?: string;
	quantity?: number;
	createdAt: string;
}

export function RecentPurchases({ take = 5 }: { take?: number }) {
	const api = useSocialProofApi();

	const { data, isLoading } = api.getRecentActivity.useQuery({
		eventType: "purchase",
		take: String(take),
	}) as {
		data: { events: EventData[] } | undefined;
		isLoading: boolean;
	};

	const events = data?.events ?? [];

	if (isLoading || events.length === 0) return null;

	const purchases = events.map((e) => ({
		...e,
		timeAgo: timeAgo(e.createdAt),
	}));

	return <RecentPurchasesTemplate purchases={purchases} />;
}
