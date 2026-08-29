import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { storeEndpoints } from "../store/endpoints/routes";

describe("gift-card store route exposure", () => {
	it("exposes only the contained balance, delivery metadata, and owned-card routes", () => {
		expect(Object.keys(storeEndpoints).sort()).toEqual(
			["/gift-cards/check", "/gift-cards/my-cards", "/gift-cards/send"].sort(),
		);

		for (const route of [
			"/gift-cards/purchase",
			"/gift-cards/top-up",
			"/gift-cards/redeem",
		]) {
			expect(storeEndpoints).not.toHaveProperty(route);
		}

		for (const source of ["purchase.ts", "top-up.ts", "redeem.ts"]) {
			expect(
				existsSync(new URL(`../store/endpoints/${source}`, import.meta.url)),
			).toBe(false);
		}
	});
});
