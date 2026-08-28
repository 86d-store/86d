import { describe, expect, it } from "vitest";

import { storeEndpoints } from "../store/endpoints/routes";

describe("gift-card store route exposure", () => {
	it("does not expose direct gift-card purchase without payment confirmation", () => {
		expect(storeEndpoints).not.toHaveProperty("/gift-cards/purchase");
	});
});
