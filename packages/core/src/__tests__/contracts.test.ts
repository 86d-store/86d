import { describe, expect, it } from "vitest";
import {
	computeInitOrder,
	formatViolations,
	getRequiredModuleIds,
	normalizeRequires,
	validateContracts,
} from "../contracts";
import type { ContractViolation, Module } from "../types/module";

function makeModule(overrides: Partial<Module> & { id: string }): Module {
	return {
		version: "1.0.0",
		schema: {},
		...overrides,
	};
}

describe("normalizeRequires", () => {
	it("returns empty object for undefined", () => {
		expect(normalizeRequires(undefined)).toEqual({});
	});

	it("converts string[] to contract form", () => {
		const result = normalizeRequires(["products", "cart"]);
		expect(result).toEqual({
			products: {},
			cart: {},
		});
	});

	it("passes through contract form unchanged", () => {
		const requires = {
			products: { read: ["productTitle"] },
			cart: { readWrite: ["cartItems"] },
		};
		expect(normalizeRequires(requires)).toBe(requires);
	});
});

describe("getRequiredModuleIds", () => {
	it("returns empty array for undefined", () => {
		expect(getRequiredModuleIds(undefined)).toEqual([]);
	});

	it("returns array directly for string[] form", () => {
		expect(getRequiredModuleIds(["a", "b"])).toEqual(["a", "b"]);
	});

	it("returns keys for contract form (non-optional only by default)", () => {
		const ids = getRequiredModuleIds({
			products: { read: ["title"] },
			discounts: { read: ["code"], optional: true },
			cart: {},
		});
		expect(ids).toEqual(["products", "cart"]);
	});

	it("returns all keys when includeOptional is true", () => {
		const ids = getRequiredModuleIds(
			{
				products: { read: ["title"] },
				discounts: { read: ["code"], optional: true },
			},
			{ includeOptional: true },
		);
		expect(ids).toEqual(["products", "discounts"]);
	});
});

describe("validateContracts", () => {
	it("returns no violations for modules without contracts", () => {
		const modules = [
			makeModule({ id: "products" }),
			makeModule({ id: "cart" }),
		];
		expect(validateContracts(modules)).toEqual([]);
	});

	it("returns no violations when simple requires are satisfied", () => {
		const modules = [
			makeModule({ id: "products" }),
			makeModule({ id: "cart", requires: ["products"] }),
		];
		expect(validateContracts(modules)).toEqual([]);
	});

	it("reports violation when required module is missing (simple form)", () => {
		const modules = [makeModule({ id: "cart", requires: ["products"] })];
		const violations = validateContracts(modules);
		expect(violations).toHaveLength(1);
		expect(violations[0]).toEqual({
			consumerId: "cart",
			providerId: "products",
			field: "*",
			requestedAccess: "read",
			reason: "module_not_found",
		});
	});

	it("reports violation when required module is missing (contract form)", () => {
		const modules = [
			makeModule({
				id: "checkout",
				requires: {
					discounts: { read: ["discountCode", "discountAmount"] },
				},
			}),
		];
		const violations = validateContracts(modules);
		expect(violations).toHaveLength(2);
		expect(violations[0].reason).toBe("module_not_found");
		expect(violations[0].field).toBe("discountCode");
		expect(violations[1].field).toBe("discountAmount");
	});

	it("returns no violations when read requirements are satisfied", () => {
		const modules = [
			makeModule({
				id: "products",
				exports: { read: ["productTitle", "productPrice"] },
			}),
			makeModule({
				id: "cart",
				requires: {
					products: { read: ["productTitle", "productPrice"] },
				},
			}),
		];
		expect(validateContracts(modules)).toEqual([]);
	});

	it("read fields satisfy read requirements even from readWrite exports", () => {
		const modules = [
			makeModule({
				id: "inventory",
				exports: { readWrite: ["productStock"] },
			}),
			makeModule({
				id: "cart",
				requires: {
					inventory: { read: ["productStock"] },
				},
			}),
		];
		expect(validateContracts(modules)).toEqual([]);
	});

	it("reports violation when read field is not exported", () => {
		const modules = [
			makeModule({
				id: "products",
				exports: { read: ["productTitle"] },
			}),
			makeModule({
				id: "cart",
				requires: {
					products: { read: ["productTitle", "productSecret"] },
				},
			}),
		];
		const violations = validateContracts(modules);
		expect(violations).toHaveLength(1);
		expect(violations[0]).toEqual({
			consumerId: "cart",
			providerId: "products",
			field: "productSecret",
			requestedAccess: "read",
			reason: "field_not_exported",
		});
	});

	it("reports violation when readWrite is required but only read is exported", () => {
		const modules = [
			makeModule({
				id: "inventory",
				exports: { read: ["productStock"] },
			}),
			makeModule({
				id: "orders",
				requires: {
					inventory: { readWrite: ["productStock"] },
				},
			}),
		];
		const violations = validateContracts(modules);
		expect(violations).toHaveLength(1);
		expect(violations[0]).toEqual({
			consumerId: "orders",
			providerId: "inventory",
			field: "productStock",
			requestedAccess: "readWrite",
			reason: "insufficient_access",
		});
	});

	it("returns no violations when readWrite requirements are satisfied", () => {
		const modules = [
			makeModule({
				id: "inventory",
				exports: { readWrite: ["productStock"] },
			}),
			makeModule({
				id: "orders",
				requires: {
					inventory: { readWrite: ["productStock"] },
				},
			}),
		];
		expect(validateContracts(modules)).toEqual([]);
	});

	it("reports violation when provider has no exports but consumer has field requirements", () => {
		const modules = [
			makeModule({ id: "products" }),
			makeModule({
				id: "cart",
				requires: {
					products: { read: ["productTitle"] },
				},
			}),
		];
		const violations = validateContracts(modules);
		expect(violations).toHaveLength(1);
		expect(violations[0].reason).toBe("field_not_exported");
	});

	it("handles multiple consumers and providers", () => {
		const modules = [
			makeModule({
				id: "products",
				exports: { read: ["productTitle", "productPrice"] },
			}),
			makeModule({
				id: "inventory",
				exports: { readWrite: ["productStock"] },
			}),
			makeModule({
				id: "cart",
				requires: {
					products: { read: ["productTitle"] },
				},
			}),
			makeModule({
				id: "orders",
				requires: {
					products: { read: ["productTitle", "productPrice"] },
					inventory: { readWrite: ["productStock"] },
				},
			}),
		];
		expect(validateContracts(modules)).toEqual([]);
	});

	it("handles mixed read and readWrite requirements for same provider", () => {
		const modules = [
			makeModule({
				id: "products",
				exports: {
					read: ["productTitle", "productPrice"],
					readWrite: ["productStock"],
				},
			}),
			makeModule({
				id: "orders",
				requires: {
					products: {
						read: ["productTitle"],
						readWrite: ["productStock"],
					},
				},
			}),
		];
		expect(validateContracts(modules)).toEqual([]);
	});

	it("reports multiple violations from the same consumer", () => {
		const modules = [
			makeModule({
				id: "products",
				exports: { read: ["productTitle"] },
			}),
			makeModule({
				id: "cart",
				requires: {
					products: {
						read: ["productTitle", "productSku"],
						readWrite: ["productTitle"],
					},
				},
			}),
		];
		const violations = validateContracts(modules);
		// productSku not exported (field_not_exported)
		// productTitle exported as read only but readWrite requested (insufficient_access)
		expect(violations).toHaveLength(2);
		expect(violations.find((v) => v.field === "productSku")?.reason).toBe(
			"field_not_exported",
		);
		expect(
			violations.find(
				(v) => v.field === "productTitle" && v.requestedAccess === "readWrite",
			)?.reason,
		).toBe("insufficient_access");
	});

	it("ignores modules with empty contract requirements", () => {
		const modules = [
			makeModule({ id: "products" }),
			makeModule({
				id: "cart",
				requires: { products: {} },
			}),
		];
		expect(validateContracts(modules)).toEqual([]);
	});

	it("skips optional dependencies when module is not installed", () => {
		const modules = [
			makeModule({
				id: "checkout",
				requires: {
					discounts: {
						read: ["validateCode"],
						optional: true,
					},
				},
			}),
		];
		expect(validateContracts(modules)).toEqual([]);
	});

	it("validates optional dependencies when module IS installed", () => {
		const modules = [
			makeModule({
				id: "discounts",
				exports: { read: ["validateCode"] },
			}),
			makeModule({
				id: "checkout",
				requires: {
					discounts: {
						read: ["validateCode", "nonExistent"],
						optional: true,
					},
				},
			}),
		];
		const violations = validateContracts(modules);
		expect(violations).toHaveLength(1);
		expect(violations[0].field).toBe("nonExistent");
		expect(violations[0].reason).toBe("field_not_exported");
	});

	it("still reports violations for non-optional missing modules", () => {
		const modules = [
			makeModule({
				id: "checkout",
				requires: {
					discounts: { read: ["validateCode"], optional: true },
					cart: { read: ["cartTotal"] },
				},
			}),
		];
		const violations = validateContracts(modules);
		// discounts is optional, so no violation
		// cart is required, so violation
		expect(violations).toHaveLength(1);
		expect(violations[0].providerId).toBe("cart");
	});
});

describe("computeInitOrder", () => {
	it("returns modules in order when no dependencies", () => {
		const modules = [
			makeModule({ id: "a" }),
			makeModule({ id: "b" }),
			makeModule({ id: "c" }),
		];
		const order = computeInitOrder(modules);
		expect(order).toEqual(["a", "b", "c"]);
	});

	it("puts dependencies before dependents", () => {
		const modules = [
			makeModule({ id: "cart", requires: ["products"] }),
			makeModule({ id: "products" }),
		];
		const order = computeInitOrder(modules);
		expect(order.indexOf("products")).toBeLessThan(order.indexOf("cart"));
	});

	it("handles contract-form requires", () => {
		const modules = [
			makeModule({
				id: "checkout",
				requires: { cart: { read: ["cartTotal"] } },
			}),
			makeModule({ id: "cart" }),
		];
		const order = computeInitOrder(modules);
		expect(order.indexOf("cart")).toBeLessThan(order.indexOf("checkout"));
	});

	it("handles deep dependency chains", () => {
		const modules = [
			makeModule({ id: "checkout", requires: ["orders"] }),
			makeModule({ id: "orders", requires: ["products"] }),
			makeModule({ id: "products" }),
		];
		const order = computeInitOrder(modules);
		expect(order.indexOf("products")).toBeLessThan(order.indexOf("orders"));
		expect(order.indexOf("orders")).toBeLessThan(order.indexOf("checkout"));
	});

	it("throws on circular dependency", () => {
		const modules = [
			makeModule({ id: "a", requires: ["b"] }),
			makeModule({ id: "b", requires: ["a"] }),
		];
		expect(() => computeInitOrder(modules)).toThrow(
			"Circular dependency detected: a → b → a",
		);
	});

	it("throws on indirect circular dependency", () => {
		const modules = [
			makeModule({ id: "a", requires: ["b"] }),
			makeModule({ id: "b", requires: ["c"] }),
			makeModule({ id: "c", requires: ["a"] }),
		];
		expect(() => computeInitOrder(modules)).toThrow(
			"Circular dependency detected",
		);
	});

	it("handles modules with no requires", () => {
		const modules = [makeModule({ id: "standalone" })];
		expect(computeInitOrder(modules)).toEqual(["standalone"]);
	});

	it("handles diamond dependencies", () => {
		// A depends on B and C, B depends on D, C depends on D
		const modules = [
			makeModule({ id: "a", requires: ["b", "c"] }),
			makeModule({ id: "b", requires: ["d"] }),
			makeModule({ id: "c", requires: ["d"] }),
			makeModule({ id: "d" }),
		];
		const order = computeInitOrder(modules);
		expect(order.indexOf("d")).toBeLessThan(order.indexOf("b"));
		expect(order.indexOf("d")).toBeLessThan(order.indexOf("c"));
		expect(order.indexOf("b")).toBeLessThan(order.indexOf("a"));
		expect(order.indexOf("c")).toBeLessThan(order.indexOf("a"));
	});

	it("skips deps not in the modules array", () => {
		const modules = [makeModule({ id: "cart", requires: ["unknown-module"] })];
		// Should not throw — external deps are handled by validateContracts
		expect(computeInitOrder(modules)).toEqual(["cart"]);
	});
});

describe("formatViolations", () => {
	it("formats module_not_found with wildcard field", () => {
		const violations: ContractViolation[] = [
			{
				consumerId: "cart",
				providerId: "products",
				field: "*",
				requestedAccess: "read",
				reason: "module_not_found",
			},
		];
		const messages = formatViolations(violations);
		expect(messages[0]).toBe(
			'Module "cart" requires module "products" but it is not installed.',
		);
	});

	it("formats module_not_found with specific field", () => {
		const violations: ContractViolation[] = [
			{
				consumerId: "checkout",
				providerId: "discounts",
				field: "discountCode",
				requestedAccess: "read",
				reason: "module_not_found",
			},
		];
		const messages = formatViolations(violations);
		expect(messages[0]).toBe(
			'Module "checkout" requires "discountCode" from "discounts" but that module is not installed.',
		);
	});

	it("formats field_not_exported", () => {
		const violations: ContractViolation[] = [
			{
				consumerId: "cart",
				providerId: "products",
				field: "productSecret",
				requestedAccess: "read",
				reason: "field_not_exported",
			},
		];
		const messages = formatViolations(violations);
		expect(messages[0]).toBe(
			'Module "cart" requires read access to "productSecret" from "products", but "products" does not export that field.',
		);
	});

	it("formats insufficient_access", () => {
		const violations: ContractViolation[] = [
			{
				consumerId: "orders",
				providerId: "inventory",
				field: "productStock",
				requestedAccess: "readWrite",
				reason: "insufficient_access",
			},
		];
		const messages = formatViolations(violations);
		expect(messages[0]).toBe(
			'Module "orders" requires readWrite access to "productStock" from "inventory", but "inventory" only exports it as read-only.',
		);
	});

	it("formats multiple violations", () => {
		const violations: ContractViolation[] = [
			{
				consumerId: "a",
				providerId: "b",
				field: "*",
				requestedAccess: "read",
				reason: "module_not_found",
			},
			{
				consumerId: "c",
				providerId: "d",
				field: "x",
				requestedAccess: "readWrite",
				reason: "insufficient_access",
			},
		];
		const messages = formatViolations(violations);
		expect(messages).toHaveLength(2);
	});
});
