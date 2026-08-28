import { describe, expect, it } from "vitest";

import { storeEndpoints } from "../store/endpoints/routes";

describe("kiosk store route exposure", () => {
	it("does not expose payment completion without an authoritative payment result", () => {
		expect(storeEndpoints).not.toHaveProperty("/kiosk/sessions/:id/complete");
	});
});
