import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	assertImplementedScreenHasOwner,
	assertLockedRouteFixturesComplete,
	LOCKED_ROUTE_FIXTURES,
} from "../../lib/merchant-ui/coverage-manifest";
import { MERCHANT_SCREEN_STATES } from "../../lib/merchant-ui/screen-states";

const productDataTableSource = readFileSync(
	new URL(
		"../../../../modules/products/src/admin/components/product-data-table.tsx",
		import.meta.url,
	),
	"utf8",
);
const fixtureLayoutSource = readFileSync(
	new URL("../%255F_merchant_ui_fixtures__/layout.tsx", import.meta.url),
	"utf8",
);

describe("merchant UI coverage manifest (store admin)", () => {
	it("escapes the leading underscore so the fixture URL is routable", () => {
		expect(readdirSync(new URL("..", import.meta.url))).toContain(
			"%5F_merchant_ui_fixtures__",
		);
		expect(
			readdirSync(
				new URL("../%255F_merchant_ui_fixtures__", import.meta.url),
			).sort(),
		).toEqual(["layout.tsx", "page.tsx"]);
		expect(fixtureLayoutSource).toContain("assertMerchantUiFixturesEnabled();");
		expect(fixtureLayoutSource).toContain(
			'export const dynamic = "force-dynamic";',
		);
	});

	it("keeps content-sized product columns reachable on narrow screens", () => {
		expect(productDataTableSource).toContain(
			"overflow-x-auto rounded-md border border-border",
		);
		expect(productDataTableSource).toContain(
			'<table className="w-max min-w-full text-sm">',
		);
		expect(productDataTableSource).toContain(
			'"sticky right-0 bg-muted/30 px-3 py-2 text-left font-medium"',
		);
		expect(productDataTableSource).toContain(
			'"sticky right-0 bg-card px-3 py-2"',
		);
		expect(productDataTableSource).not.toContain(
			'<div className="relative sticky right-0">',
		);
	});

	it("registers all five states for locked store admin routes", () => {
		expect(() => assertLockedRouteFixturesComplete()).not.toThrow();
		expect(LOCKED_ROUTE_FIXTURES).toHaveLength(10);
		expect(MERCHANT_SCREEN_STATES).toHaveLength(5);
	});

	it("fails when an implemented screen has no owner", () => {
		expect(() =>
			assertImplementedScreenHasOwner("/admin/unassigned-surface"),
		).toThrow(/no owning plan/);
	});

	it("accepts locked product routes", () => {
		expect(() =>
			assertImplementedScreenHasOwner("/admin/products"),
		).not.toThrow();
		expect(() =>
			assertImplementedScreenHasOwner("/admin/products/new"),
		).not.toThrow();
	});
});
