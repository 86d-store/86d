import { describe, expect, it } from "vitest";
import { readAccountOverview } from "../_hooks/account-overview-data";

const response = {
	orders: [
		{
			id: "order/with space",
			orderNumber: "ORD-1001",
			status: "processing",
			total: 12345,
			currency: "USD",
			createdAt: "2026-09-08T12:00:00.000Z",
		},
	],
	total: 6,
	page: 1,
	limit: 5,
	pages: 2,
};

const genericError = {
	status: "error",
	issue: {
		title: "Your orders could not be loaded",
		description:
			"Try again, or track an order using the details from your confirmation.",
		canRetry: true,
		action: null,
	},
};

function read(data: unknown) {
	return readAccountOverview({ data, isPending: false, isError: false });
}

describe("account overview data", () => {
	it("formats validated orders and escapes identifiers in detail links", () => {
		const state = read(response);
		expect(state.status).toBe("ready");
		if (state.status !== "ready") return;
		expect(state.orders[0]).toMatchObject({
			href: "/account/orders/order%2Fwith%20space",
			number: "ORD-1001",
			status: "processing",
			total: "$123.45",
		});
		expect(state.pageLabel).toBe("Page 1 of 2");
		expect(state.totalLabel).toBe("6 orders");
	});

	it("keeps loading and failed requests distinct from an empty history", () => {
		expect(
			readAccountOverview({ data: undefined, isPending: true, isError: false }),
		).toEqual({ status: "loading" });
		expect(
			readAccountOverview({ data: response, isPending: false, isError: true }),
		).toEqual(genericError);
		expect(
			read({ error: "Order history is unavailable", status: 503 }),
		).toEqual(genericError);
		expect(read(undefined)).toEqual(genericError);
		expect(read({ ...response, orders: [], total: 0, pages: 0 })).toMatchObject(
			{ status: "ready", orders: [], total: 0, pageLabel: "Page 1 of 1" },
		);
	});

	it("rejects malformed dates, currency, and totals before formatting", () => {
		for (const fields of [
			{ createdAt: "invalid" },
			{ currency: "dollars" },
			{ total: Number.NaN },
			{ total: Number.POSITIVE_INFINITY },
		]) {
			expect(
				read({ ...response, orders: [{ ...response.orders[0], ...fields }] }),
			).toEqual(genericError);
		}
	});

	it("preserves empty later pages so the view can offer previous-page recovery", () => {
		expect(read({ ...response, orders: [], page: 3 })).toMatchObject({
			status: "ready",
			total: 6,
			page: 3,
			pages: 2,
			pageLabel: "Page 3",
		});
	});

	it("offers sign-in recovery for an expired session from HTTP or returned data", () => {
		for (const state of [
			read({ status: 401, error: "Unauthorized" }),
			readAccountOverview({
				data: response,
				isPending: false,
				isError: true,
				error: {
					status: 401,
					body: { code: "CUSTOMER_AUTHENTICATION_REQUIRED" },
				},
			}),
		]) {
			expect(state).toEqual({
				status: "error",
				issue: {
					title: "Sign in to view your orders",
					description:
						"Your session has expired. Sign in again to open your order history.",
					canRetry: false,
					action: {
						href: "/auth/signin?redirect=%2Faccount",
						label: "Sign in",
					},
				},
			});
		}
	});

	it("explains required email verification using only the known failure code", () => {
		const expected = {
			status: "error",
			issue: {
				title: "Verify your email to view your orders",
				description:
					"Your account's email address needs verification. Complete email verification, then try again. You can also track an order with the details from your confirmation.",
				canRetry: true,
				action: null,
			},
		};
		const code = "CUSTOMER_EMAIL_VERIFICATION_REQUIRED";
		expect(read({ status: 403, code, error: "private detail" })).toEqual(
			expected,
		);
		for (const body of [
			{ code },
			{ error: { code, message: "private detail" } },
		]) {
			expect(
				readAccountOverview({
					data: undefined,
					isPending: false,
					isError: true,
					error: { status: 403, body },
				}),
			).toEqual(expected);
		}
	});

	it("does not invent email verification or expose upstream copy for other failures", () => {
		expect(
			read({ status: 403, code: "UNKNOWN", error: "private detail" }),
		).toEqual({
			status: "error",
			issue: {
				title: "Order history access is restricted",
				description:
					"This account cannot access order history. Contact the store for help, or track an order with the details from your confirmation.",
				canRetry: false,
				action: null,
			},
		});
		expect(
			read({
				status: 500,
				code: "CUSTOMER_EMAIL_VERIFICATION_REQUIRED",
				error: "private detail",
			}),
		).toEqual(genericError);
		expect(
			readAccountOverview({
				data: undefined,
				isPending: false,
				isError: true,
				error: new Error("private detail"),
			}),
		).toEqual(genericError);
	});
});
