"use client";

import { useSocialProofApi } from "./_hooks";

// ── Trust Badges ──────────────────────────────────────────────────────────────

interface BadgeData {
	id: string;
	name: string;
	icon: string;
	url?: string | undefined;
}

export function TrustBadgesSection({
	position = "product",
}: {
	position?: string;
}) {
	const api = useSocialProofApi();

	const { data, isLoading, isError } = api.listBadges.useQuery({
		position,
		take: "20",
	}) as {
		data: { badges?: BadgeData[] } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	if (isError || (!isLoading && !data?.badges?.length)) return null;

	const badges = data?.badges ?? [];

	if (isLoading) {
		return (
			<div className="flex flex-wrap gap-3">
				{[1, 2, 3].map((n) => (
					<div key={n} className="h-6 w-24 animate-pulse rounded bg-muted" />
				))}
			</div>
		);
	}

	return (
		<div className="flex flex-wrap gap-x-4 gap-y-2">
			{badges.map((badge) =>
				badge.url ? (
					<a
						key={badge.id}
						href={badge.url}
						className="transition-opacity hover:opacity-70"
					>
						<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
							<span aria-hidden="true">{badge.icon}</span>
							<span>{badge.name}</span>
						</span>
					</a>
				) : (
					<span
						key={badge.id}
						className="flex items-center gap-1.5 text-muted-foreground text-xs"
					>
						<span aria-hidden="true">{badge.icon}</span>
						<span>{badge.name}</span>
					</span>
				),
			)}
		</div>
	);
}

// ── Product Activity ──────────────────────────────────────────────────────────

interface ActivityData {
	purchaseCount: number;
	viewCount: number;
	totalEvents: number;
}

export function ProductActivitySection({
	productId,
	period = "24h",
}: {
	productId: string;
	period?: string;
}) {
	const api = useSocialProofApi();

	const { data, isError } = api.getProductActivity.useQuery({
		productId,
		period,
	}) as {
		data: { activity?: ActivityData } | undefined;
		isError: boolean;
	};

	const activity = data?.activity;

	if (isError || !activity || activity.totalEvents === 0) return null;

	const parts: string[] = [];
	if (activity.purchaseCount > 0) {
		parts.push(`${activity.purchaseCount} sold recently`);
	} else if (activity.viewCount > 5) {
		parts.push(`${activity.viewCount} people viewing`);
	}

	if (parts.length === 0) return null;

	return <p className="text-muted-foreground text-xs">{parts.join(" · ")}</p>;
}
