import { describe, expect, it, vi } from "vitest";

vi.mock("api/client", () => ({ api: {} }));

import { isAuthorityAllowed } from "~/console/permission-gate";

describe("isAuthorityAllowed", () => {
	it("fails closed while the effective Authority projection is loading", () => {
		expect(
			isAuthorityAllowed(
				{
					isLoading: true,
					isOwner: true,
					hasPermission: () => true,
				},
				{ team: ["update"] },
			),
		).toBe(false);
	});

	it("enforces owner-only gates in addition to action permissions", () => {
		const authority = {
			isLoading: false,
			isOwner: false,
			hasPermission: () => true,
		};

		expect(isAuthorityAllowed(authority, { team: ["delete"] })).toBe(true);
		expect(isAuthorityAllowed(authority, { team: ["delete"] }, true)).toBe(
			false,
		);
	});

	it("requires every declared action permission", () => {
		expect(
			isAuthorityAllowed(
				{
					isLoading: false,
					isOwner: true,
					hasPermission: (category, action) =>
						category === "team" && action === "read",
				},
				{ team: ["read", "update"] },
			),
		).toBe(false);
	});
});
