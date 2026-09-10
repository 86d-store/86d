import { describe, expect, it } from "vitest";
import {
	combineDashboardState,
	countResponse,
	type DashboardQuery,
	dashboardIssue,
	formatDashboardDate,
	formatDashboardMoney,
	inventoryResponse,
	mapDashboardState,
	ordersResponse,
	readDashboardState,
} from "../_hooks/dashboard-data";

function successful(data: unknown): DashboardQuery {
	return { data, isPending: false, isError: false, error: null };
}

describe("dashboard query state", () => {
	it("shows loading until this request completes", () => {
		expect(
			readDashboardState(
				{ ...successful(undefined), isPending: true },
				countResponse,
			),
		).toEqual({ status: "loading" });
	});

	it("keeps real zero values distinct from absent or malformed data", () => {
		expect(readDashboardState(successful({ total: 0 }), countResponse)).toEqual(
			{ status: "ready", data: { total: 0 } },
		);
		for (const data of [
			undefined,
			{},
			{ total: "0" },
			{ total: -1 },
			{ total: Number.NaN },
		]) {
			expect(readDashboardState(successful(data), countResponse).status).toBe(
				"error",
			);
		}
	});

	it("does not present stale data as current after a failed refresh", () => {
		const state = readDashboardState(
			{ ...successful({ total: 0 }), isError: true, error: { status: 503 } },
			countResponse,
		);
		expect(state.status).toBe("error");
		expect(mapDashboardState(state, ({ total }) => String(total))).toEqual(
			state,
		);
	});

	it("requires a valid response before showing no low-stock alerts", () => {
		expect(
			readDashboardState(successful({ items: [] }), inventoryResponse),
		).toEqual({ status: "ready", data: { items: [] } });
		expect(readDashboardState(successful({}), inventoryResponse).status).toBe(
			"error",
		);
	});

	it("does not construct a partial product ratio", () => {
		const loaded = readDashboardState(successful({ total: 10 }), countResponse);
		const failed = readDashboardState(
			successful({ status: 403, error: "denied" }),
			countResponse,
		);
		const loading = readDashboardState(
			{ ...successful(undefined), isPending: true },
			countResponse,
		);
		const ratio = (active: { total: number }, total: { total: number }) =>
			`${active.total} / ${total.total}`;
		expect(combineDashboardState(loaded, failed, ratio)).toEqual(failed);
		expect(combineDashboardState(loading, failed, ratio)).toEqual(failed);
		expect(combineDashboardState(loaded, loading, ratio)).toEqual({
			status: "loading",
		});
		expect(combineDashboardState(loaded, loaded, ratio)).toEqual({
			status: "ready",
			data: "10 / 10",
		});
	});

	it("maps authorization and service failures without exposing upstream messages", () => {
		expect(
			dashboardIssue({ status: 403, message: "private upstream detail" })
				.description,
		).toContain("store owner or administrator");
		expect(dashboardIssue({ status: 401 }).description).toContain(
			"Sign in again",
		);
		expect(dashboardIssue({ status: 503 }).description).toContain(
			"has not been changed",
		);
		expect(
			dashboardIssue(new Error("private upstream detail")).description,
		).not.toContain("private upstream detail");
	});
});

describe("dashboard order presentation", () => {
	const order = {
		id: "order-1",
		orderNumber: "1001",
		status: "pending",
		total: 12345,
		currency: "EUR",
		createdAt: "2026-09-08T23:30:00Z",
	};

	it("formats an order with its own currency", () => {
		expect(formatDashboardMoney(order.total, order.currency)).toBe("€123.45");
		expect(formatDashboardMoney(order.total, "GBP")).toBe("£123.45");
	});

	it("uses a stable UTC date instead of hydration-dependent relative time", () => {
		expect(formatDashboardDate(order.createdAt)).toBe("Sep 8");
	});

	it("rejects invalid money and dates before rendering records", () => {
		expect(ordersResponse.safeParse({ orders: [order] }).success).toBe(true);
		for (const invalid of [
			{ currency: "invalid" },
			{ createdAt: "invalid" },
			{ total: Number.NaN },
		]) {
			expect(
				ordersResponse.safeParse({ orders: [{ ...order, ...invalid }] })
					.success,
			).toBe(false);
		}
	});
});
