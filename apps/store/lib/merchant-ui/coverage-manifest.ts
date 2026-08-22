import {
	LOCKED_MERCHANT_ROUTES,
	MERCHANT_SCREEN_STATES,
	type MerchantScreenState,
} from "./screen-states";

export type FixtureRegistration = {
	routeId: (typeof LOCKED_MERCHANT_ROUTES)[number]["id"];
	state: MerchantScreenState;
	fixtureModule: string;
};

export const LOCKED_ROUTE_FIXTURES: FixtureRegistration[] = [
	{
		routeId: "store-admin.products",
		state: "empty",
		fixtureModule:
			"modules/products/src/admin/components/_fixtures/product-list.fixtures.ts",
	},
	{
		routeId: "store-admin.products",
		state: "loading",
		fixtureModule:
			"modules/products/src/admin/components/_fixtures/product-list.fixtures.ts",
	},
	{
		routeId: "store-admin.products",
		state: "error",
		fixtureModule:
			"modules/products/src/admin/components/_fixtures/product-list.fixtures.ts",
	},
	{
		routeId: "store-admin.products",
		state: "permission",
		fixtureModule:
			"modules/products/src/admin/components/_fixtures/product-list.fixtures.ts",
	},
	{
		routeId: "store-admin.products",
		state: "provider",
		fixtureModule:
			"modules/products/src/admin/components/_fixtures/product-list.fixtures.ts",
	},
	{
		routeId: "store-admin.products.new",
		state: "empty",
		fixtureModule:
			"modules/products/src/admin/components/_fixtures/product-new.fixtures.ts",
	},
	{
		routeId: "store-admin.products.new",
		state: "loading",
		fixtureModule:
			"modules/products/src/admin/components/_fixtures/product-new.fixtures.ts",
	},
	{
		routeId: "store-admin.products.new",
		state: "error",
		fixtureModule:
			"modules/products/src/admin/components/_fixtures/product-new.fixtures.ts",
	},
	{
		routeId: "store-admin.products.new",
		state: "permission",
		fixtureModule:
			"modules/products/src/admin/components/_fixtures/product-new.fixtures.ts",
	},
	{
		routeId: "store-admin.products.new",
		state: "provider",
		fixtureModule:
			"modules/products/src/admin/components/_fixtures/product-new.fixtures.ts",
	},
];

export const REMAINING_SCREEN_OWNERS: Array<{
	path: string;
	owningPlan: string;
	kind: "form" | "table" | "other";
}> = [
	{ path: "/admin/categories", owningPlan: "019", kind: "table" },
	{ path: "/admin/orders", owningPlan: "024", kind: "table" },
	{ path: "/admin/customers", owningPlan: "025", kind: "table" },
	{ path: "/admin/collections", owningPlan: "019", kind: "table" },
	{ path: "/admin/pages", owningPlan: "020", kind: "other" },
];

export function assertLockedRouteFixturesComplete(
	fixtures: FixtureRegistration[] = LOCKED_ROUTE_FIXTURES,
	routeIds: Array<(typeof LOCKED_MERCHANT_ROUTES)[number]["id"]> = [
		"store-admin.products",
		"store-admin.products.new",
	],
) {
	const missing: string[] = [];
	for (const routeId of routeIds) {
		for (const state of MERCHANT_SCREEN_STATES) {
			const found = fixtures.some(
				(fixture) => fixture.routeId === routeId && fixture.state === state,
			);
			if (!found) {
				missing.push(`${routeId}:${state}`);
			}
		}
	}
	if (missing.length > 0) {
		throw new Error(
			`Missing merchant UI five-state fixtures: ${missing.join(", ")}`,
		);
	}
}

export function assertImplementedScreenHasOwner(
	path: string,
	owners: typeof REMAINING_SCREEN_OWNERS = REMAINING_SCREEN_OWNERS,
	locked = LOCKED_MERCHANT_ROUTES,
) {
	const isLocked = locked.some((route) => route.path === path);
	if (isLocked) return;
	const owned = owners.some(
		(entry) =>
			entry.path === path || path.startsWith(entry.path.replace("*", "")),
	);
	if (!owned) {
		throw new Error(
			`Implemented merchant screen ${path} has no owning plan or locked fixture registration`,
		);
	}
}
