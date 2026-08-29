import { describe, expect, it } from "vitest";

import { storeEndpoints } from "../store/endpoints/routes";

describe("kiosk store route exposure", () => {
	it("withdraws every unauthenticated kiosk endpoint", () => {
		expect(storeEndpoints).toEqual({});
	});
});
