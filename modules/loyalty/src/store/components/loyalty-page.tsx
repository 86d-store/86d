"use client";

import LoyaltyPageTemplate from "./loyalty-page.mdx";
import { PointsBalance } from "./points-balance";
import { PointsHistory } from "./points-history";
import { TierProgress } from "./tier-progress";

export function LoyaltyPage() {
	return (
		<LoyaltyPageTemplate
			balanceCard={<PointsBalance />}
			tierCard={<TierProgress />}
			historySection={<PointsHistory />}
		/>
	);
}
