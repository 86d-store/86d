"use client";

import { useLoyaltyApi } from "./_hooks";
import { formatPoints, getTierColor } from "./_utils";
import TierProgressTemplate from "./tier-progress.mdx";

interface TierInfo {
	id: string;
	name: string;
	slug: string;
	minPoints: number;
	multiplier: number;
	perks?: Record<string, unknown> | undefined;
	sortOrder: number;
}

export function TierProgress() {
	const api = useLoyaltyApi();

	const { data: balanceData, isLoading: loadingBalance } =
		api.getBalance.useQuery({}) as {
			data:
				| { balance: number; tier: string; lifetimeEarned: number }
				| { error: string; status: number }
				| undefined;
			isLoading: boolean;
		};

	const { data: tiersData, isLoading: loadingTiers } = api.getTiers.useQuery(
		{},
	) as {
		data: { tiers: TierInfo[] } | undefined;
		isLoading: boolean;
	};

	const isUnauthenticated =
		!loadingBalance &&
		(balanceData as { status?: number } | undefined)?.status === 401;

	if (isUnauthenticated) {
		return (
			<div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800">
				<p className="text-muted-foreground text-sm">
					Sign in to view your tier progress.
				</p>
			</div>
		);
	}

	if (loadingBalance || loadingTiers) {
		return (
			<div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800">
				<div className="animate-pulse space-y-3">
					<div className="h-4 w-32 rounded bg-muted dark:bg-muted" />
					<div className="h-3 w-full rounded-full bg-muted dark:bg-muted" />
					<div className="h-3 w-48 rounded bg-muted dark:bg-muted" />
				</div>
			</div>
		);
	}

	const successBalance = balanceData as
		| { balance: number; tier: string; lifetimeEarned: number }
		| undefined;

	if (!successBalance || !tiersData) return null;

	const tiers = [...tiersData.tiers].sort((a, b) => a.minPoints - b.minPoints);
	const currentTierIndex = tiers.findIndex(
		(t) => t.slug === successBalance.tier,
	);
	const currentTier = tiers[currentTierIndex];
	const nextTier = tiers[currentTierIndex + 1];

	const currentColor = getTierColor(successBalance.tier);

	let progressPercent = 100;
	let pointsToNext = 0;
	let progressLabel = "Max tier reached";

	if (nextTier && currentTier) {
		const range = nextTier.minPoints - currentTier.minPoints;
		const progress = successBalance.lifetimeEarned - currentTier.minPoints;
		progressPercent = Math.min(
			100,
			Math.max(0, Math.round((progress / range) * 100)),
		);
		pointsToNext = Math.max(
			0,
			nextTier.minPoints - successBalance.lifetimeEarned,
		);
		progressLabel = `${formatPoints(pointsToNext)} pts to ${nextTier.name}`;
	}

	const tierSteps = (
		<div className="mt-4 flex justify-between">
			{tiers.map((tier) => {
				const color = getTierColor(tier.slug);
				const isActive = tier.slug === successBalance.tier;
				const isPast =
					tiers.indexOf(tier) <
					tiers.findIndex((t) => t.slug === successBalance.tier);
				return (
					<div key={tier.id} className="flex flex-col items-center gap-1">
						<div
							className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
								isActive
									? `${color.bg} ${color.text} ring-2 ${color.ring}`
									: isPast
										? `${color.bg} ${color.text}`
										: "bg-muted text-muted-foreground"
							}`}
						>
							{isPast ? "\u2713" : isActive ? "\u2605" : "\u00B7"}
						</div>
						<span
							className={`text-xs capitalize ${
								isActive
									? `font-semibold ${color.text}`
									: "text-muted-foreground"
							}`}
						>
							{tier.name}
						</span>
					</div>
				);
			})}
		</div>
	);

	return (
		<TierProgressTemplate
			tierName={currentTier?.name ?? successBalance.tier}
			tierBg={currentColor.bg}
			tierText={currentColor.text}
			progressPercent={progressPercent}
			progressLabel={progressLabel}
			tierSteps={tierSteps}
			multiplier={
				currentTier && currentTier.multiplier > 1
					? `${currentTier.multiplier}x points`
					: null
			}
		/>
	);
}
