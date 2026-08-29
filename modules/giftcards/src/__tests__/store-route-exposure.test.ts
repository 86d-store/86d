import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { storeEndpoints } from "../store/endpoints/routes";

describe("gift-card store route exposure", () => {
	it("does not expose direct value creation without payment confirmation", () => {
		for (const route of ["/gift-cards/purchase", "/gift-cards/top-up"]) {
			expect(storeEndpoints).not.toHaveProperty(route);
		}

		for (const source of ["purchase.ts", "top-up.ts"]) {
			expect(
				existsSync(new URL(`../store/endpoints/${source}`, import.meta.url)),
			).toBe(false);
		}
	});
});
