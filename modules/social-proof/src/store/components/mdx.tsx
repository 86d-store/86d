import type { MDXComponents } from "mdx/types";
import { ProductActivity } from "./product-activity";
import { RecentPurchases } from "./recent-purchases";
import { TrustBadges } from "./trust-badges";

export { ProductActivity, RecentPurchases, TrustBadges };

export default {
	ProductActivity,
	RecentPurchases,
	TrustBadges,
} satisfies MDXComponents;
