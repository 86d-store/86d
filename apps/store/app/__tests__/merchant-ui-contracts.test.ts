import { describe, expect, it } from "vitest";
import {
	assertImplementedScreenHasOwner,
	assertLockedRouteFixturesComplete,
	LOCKED_ROUTE_FIXTURES,
} from "../../lib/merchant-ui/coverage-manifest";
import { MERCHANT_SCREEN_STATES } from "../../lib/merchant-ui/screen-states";

describe("merchant UI coverage manifest (store admin)", () => {
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
