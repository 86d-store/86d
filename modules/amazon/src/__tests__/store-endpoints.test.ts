import { describe, expect, it } from "vitest";
import { createStoreEndpoints } from "../store/endpoints/routes";

describe("Amazon SP-API store endpoints", () => {
	it("does not register the unsupported HTTP notification ingress", () => {
		expect(createStoreEndpoints()).not.toHaveProperty("/amazon/webhooks");
	});
});
