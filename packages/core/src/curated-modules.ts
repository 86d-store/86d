/** Curated launch module set — admitted at provision without advanced opt-in. */
export const CURATED_STORE_MODULES = [
	"products",
	"collections",
	"cart",
	"checkout",
	"orders",
	"payments",
	"customers",
	"inventory",
	"stripe",
	"shipping",
	"tax",
	"discounts",
	"reviews",
	"newsletter",
	"pages",
	"navigation",
	"seo",
	"sitemap",
	"media",
	"settings",
	"analytics",
	"search",
	"notifications",
] as const;

export type CuratedStoreModule = (typeof CURATED_STORE_MODULES)[number];

const CURATED_MODULE_SET = new Set<string>(CURATED_STORE_MODULES);

export function isCuratedStoreModule(
	moduleId: string,
): moduleId is CuratedStoreModule {
	return CURATED_MODULE_SET.has(moduleId);
}

/** Tier-none curated modules with no compiled tables. */
export const TIER_NONE_CURATED_MODULES = [
	"stripe",
] as const satisfies readonly CuratedStoreModule[];
