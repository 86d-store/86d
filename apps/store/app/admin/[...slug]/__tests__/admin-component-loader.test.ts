import { describe, expect, it } from "vitest";
import {
	isRenderableAdminComponentExport,
	resolveAdminRouteComponent,
} from "../admin-component-loader";

describe("resolveAdminRouteComponent", () => {
	it("throws when the requested export is missing", () => {
		expect(() =>
			resolveAdminRouteComponent({ Existing: () => null }, "wish", "WishAdmin"),
		).toThrowError(
			"Component WishAdmin not found in module wish. Available exports: Existing",
		);
	});

	it("throws when the requested export is a truthy non-component object", () => {
		expect(() =>
			resolveAdminRouteComponent(
				{ WishAdmin: { title: "not-a-component" } },
				"wish",
				"WishAdmin",
			),
		).toThrowError(
			"Component WishAdmin in module wish resolved to object. Available exports: WishAdmin",
		);
	});

	it("returns valid function component exports", () => {
		const Component = () => null;

		expect(
			resolveAdminRouteComponent({ WishAdmin: Component }, "wish", "WishAdmin"),
		).toBe(Component);
	});
});

describe("isRenderableAdminComponentExport", () => {
	it("accepts React wrapper objects", () => {
		expect(
			isRenderableAdminComponentExport({
				$$typeof: Symbol.for("react.memo"),
			}),
		).toBe(true);
	});
});
