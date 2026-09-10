import { describe, expect, it } from "vitest";
import { getAccountNavigationHref } from "../_components/account-navigation";

describe("account navigation selection", () => {
	it("selects the order section for detail and invoice pages", () => {
		expect(getAccountNavigationHref("/account/orders/order-1/invoice")).toBe(
			"/account/orders",
		);
	});

	it("does not select a sibling with a matching prefix", () => {
		expect(getAccountNavigationHref("/account/orders-archive")).toBeUndefined();
	});

	it("only selects overview at the account root", () => {
		expect(getAccountNavigationHref("/account")).toBe("/account");
		expect(getAccountNavigationHref("/account/new-feature")).toBeUndefined();
	});
});
