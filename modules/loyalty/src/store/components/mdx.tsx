"use client";

import type { MDXComponents } from "mdx/types";
import { LoyaltyPage } from "./loyalty-page";
import { PointsBalance } from "./points-balance";
import { PointsHistory } from "./points-history";
import { TierProgress } from "./tier-progress";

export default {
	PointsBalance,
	TierProgress,
	PointsHistory,
	LoyaltyPage,
} satisfies MDXComponents;
