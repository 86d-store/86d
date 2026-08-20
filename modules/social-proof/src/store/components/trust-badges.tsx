"use client";

import { useSocialProofApi } from "./_hooks";
import TrustBadgesTemplate from "./trust-badges.mdx";

interface BadgeData {
	id: string;
	name: string;
	description?: string;
	icon: string;
	url?: string;
	position: string;
	priority: number;
}

export function TrustBadges({ position = "product" }: { position?: string }) {
	const api = useSocialProofApi();

	const { data, isLoading } = api.listBadges.useQuery({
		position,
		take: "20",
	}) as {
		data: { badges: BadgeData[] } | undefined;
		isLoading: boolean;
	};

	const badges = data?.badges ?? [];

	if (isLoading || badges.length === 0) return null;

	return <TrustBadgesTemplate badges={badges} />;
}
