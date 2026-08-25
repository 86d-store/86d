import { describe, expect, it } from "vitest";
import { resolveTransactionHistoryQuery } from "../store/components/transaction-history-state";

describe("storefront transaction history state", () => {
	it("fails closed when a completed query has no authoritative data", () => {
		expect(
			resolveTransactionHistoryQuery({
				data: undefined,
				isError: false,
				isLoading: false,
			}),
		).toEqual({ status: "unavailable" });
	});

	it("fails closed when the endpoint returns an unavailable envelope", () => {
		expect(
			resolveTransactionHistoryQuery({
				data: {
					code: "REVENUE_SOURCE_UNAVAILABLE",
					error: "Authoritative payment history is unavailable.",
					status: 503,
				},
				isError: false,
				isLoading: false,
			}),
		).toEqual({ status: "unavailable" });
	});

	it("requires authentication when the endpoint returns an unauthorized envelope", () => {
		expect(
			resolveTransactionHistoryQuery({
				data: { error: "Unauthorized", status: 401 },
				isError: false,
				isLoading: false,
			}),
		).toEqual({ status: "unauthenticated" });
	});
});
