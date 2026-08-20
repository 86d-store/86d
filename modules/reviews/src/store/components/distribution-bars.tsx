"use client";

import DistributionBarsTemplate from "./distribution-bars.mdx";

export function DistributionBars({
	distribution,
	total,
}: {
	distribution: Record<string, number>;
	total: number;
}) {
	return <DistributionBarsTemplate distribution={distribution} total={total} />;
}
