import { describe, expect, it } from "vitest";
import { PRODUCT_LIST_STATES } from "../components/_fixtures/product-list.fixtures";
import {
	createProductFormAdapter,
	PRODUCT_NEW_INVALID_FIXTURES,
	PRODUCT_NEW_SERVER_BODY,
	PRODUCT_NEW_STATES,
	PRODUCT_NEW_VALID_FIXTURE,
} from "../components/_fixtures/product-new.fixtures";
import {
	createProductFormSchema,
	formValuesToCreateBody,
} from "../form/create-product-schema";
import { MERCHANT_SCREEN_STATES } from "../form/screen-states";

describe("product create form contract", () => {
	it("registers five states for the locked form and list", () => {
		for (const state of MERCHANT_SCREEN_STATES) {
			expect(PRODUCT_NEW_STATES).toContain(state);
			expect(PRODUCT_LIST_STATES).toContain(state);
		}
	});

	it("rejects invalid fixtures with the shared Zod schema", () => {
		for (const fixture of PRODUCT_NEW_INVALID_FIXTURES) {
			expect(createProductFormAdapter.safeParse(fixture).success).toBe(false);
			expect(createProductFormSchema.safeParse(fixture).success).toBe(false);
		}
	});

	it("round-trips valid defaults and maps to the server body", () => {
		expect(
			createProductFormAdapter.roundTrip(PRODUCT_NEW_VALID_FIXTURE),
		).toEqual(PRODUCT_NEW_VALID_FIXTURE);
		expect(PRODUCT_NEW_SERVER_BODY.price).toBe(1800);
		expect(formValuesToCreateBody(PRODUCT_NEW_VALID_FIXTURE).slug).toBe(
			"house-blend-coffee",
		);
	});
});
