import { describe, expect, it } from "vitest";
import type { ModuleDataRow } from "../backfill-module-tables";
import {
	analyzeMoneyInvariant,
	formatMoneyDefect,
} from "../money-invariant-report";

describe("analyzeMoneyInvariant", () => {
	it("reports exactly one subject overrun and skips violating transaction insert", () => {
		const rows: ModuleDataRow[] = [
			{
				moduleName: "orders",
				entityType: "order",
				entityId: "order-1",
				data: {
					id: "order-1",
					customerId: "customer-1",
					total: 10_000,
					currency: "USD",
					paymentStatus: "paid",
				},
			},
			{
				moduleName: "customers",
				entityType: "customer",
				entityId: "customer-1",
				data: {
					id: "customer-1",
					name: "Ada Lovelace",
					email: "ada@example.com",
				},
			},
			{
				moduleName: "payments",
				entityType: "paymentIntent",
				entityId: "pi-1",
				data: {
					id: "pi-1",
					orderId: "order-1",
					customerId: "customer-1",
					amount: 15_000,
					currency: "USD",
					status: "succeeded",
				},
			},
		];

		const summary = analyzeMoneyInvariant(rows);
		const overruns = summary.defects.filter(
			(defect) => defect.code === "subject_overrun",
		);
		expect(overruns).toHaveLength(1);
		expect(formatMoneyDefect(overruns[0] ?? summary.defects[0])).toContain(
			"subject_overrun",
		);
		expect(summary.insertedTransactions).toBe(0);
	});

	it("prints zero defects for empty-money stores", () => {
		const summary = analyzeMoneyInvariant([]);
		expect(summary.defects).toHaveLength(0);
	});

	it("accepts aligned luxury-house style order and payment totals", () => {
		const rows: ModuleDataRow[] = [
			{
				moduleName: "orders",
				entityType: "order",
				entityId: "order-demo",
				data: {
					id: "order-demo",
					customerId: "customer-demo",
					total: 97_197,
					currency: "USD",
					paymentStatus: "paid",
				},
			},
			{
				moduleName: "customers",
				entityType: "customer",
				entityId: "customer-demo",
				data: {
					id: "customer-demo",
					name: "Eleanor Vale",
					email: "eleanor@example.com",
				},
			},
			{
				moduleName: "payments",
				entityType: "paymentIntent",
				entityId: "pi-demo",
				data: {
					id: "pi-demo",
					orderId: "order-demo",
					customerId: "customer-demo",
					amount: 97_197,
					currency: "USD",
					status: "succeeded",
				},
			},
		];

		const summary = analyzeMoneyInvariant(rows);
		expect(summary.defects).toHaveLength(0);
		expect(summary.insertedTransactions).toBe(1);
	});
});
