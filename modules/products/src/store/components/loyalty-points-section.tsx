"use client";

import { useLoyaltyApi } from "./_hooks";

/**
 * Shows estimated loyalty points earned for this purchase on the product detail page.
 * Returns null when the loyalty module is not installed or when no points would be earned.
 */
export function LoyaltyPointsSection({
	priceInCents,
}: {
	priceInCents: number;
}) {
	const api = useLoyaltyApi();
	const calculatePoints = api.calculatePoints;
	if (!calculatePoints?.useQuery) return null;
	return (
		<LoyaltyPointsQuery
			calculatePoints={calculatePoints}
			priceInCents={priceInCents}
		/>
	);
}

function LoyaltyPointsQuery({
	calculatePoints,
	priceInCents,
}: {
	calculatePoints: NonNullable<
		ReturnType<typeof useLoyaltyApi>["calculatePoints"]
	>;
	priceInCents: number;
}) {
	const { data, isError } = calculatePoints.useQuery(
		{ amount: priceInCents },
		{ enabled: priceInCents > 0 },
	) as {
		data: { points: number; amount: number } | undefined;
		isError: boolean;
	};

	if (isError || !data || data.points <= 0) return null;

	return (
		<div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-amber-700 text-xs dark:bg-amber-950/40 dark:text-amber-400">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
			</svg>
			Earn {data.points} {data.points === 1 ? "point" : "points"} with this
			purchase
		</div>
	);
}
