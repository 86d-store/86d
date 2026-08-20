import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const generatedApi = readFileSync(
	resolve(import.meta.dirname, "../../generated/api.ts"),
	"utf8",
);
const generatedComponents = readFileSync(
	resolve(import.meta.dirname, "../../generated/components.ts"),
	"utf8",
);

function countOccurrences(source: string, needle: string): number {
	return source.split(needle).length - 1;
}

describe("generated routing", () => {
	it("assigns top-level collection and returns routes to the dedicated modules", () => {
		expect(generatedApi).toContain('pattern: "/admin/collections"');
		expect(generatedApi).toContain('moduleId: "collections"');
		expect(generatedApi).toContain('pattern: "/admin/returns"');
		expect(generatedApi).toContain('moduleId: "returns"');
		expect(generatedApi).not.toContain(
			'pattern: "/admin/returns",\n\t\tmoduleId: "orders"',
		);
	});

	it("emits namespaced legacy product and order admin routes", () => {
		expect(generatedApi).toContain(
			'pattern: "/admin/products/collections/list"',
		);
		expect(generatedApi).toContain('moduleId: "products"');
		expect(generatedApi).toContain('pattern: "/admin/orders/returns"');
		expect(generatedApi).toContain('moduleId: "orders"');
	});

	it("does not emit duplicate top-level admin patterns for collections or returns", () => {
		expect(
			countOccurrences(generatedApi, 'pattern: "/admin/collections"'),
		).toBe(1);
		expect(countOccurrences(generatedApi, 'pattern: "/admin/returns"')).toBe(1);
	});
});

describe("generated components", () => {
	it("imports and spreads template component overrides last so they take precedence", () => {
		expect(generatedComponents).toContain(
			'import templateOverrides from "template/components/mdx"',
		);
		expect(generatedComponents).toContain("...templateOverrides,");
		const overrideSpreadIndex = generatedComponents.lastIndexOf(
			"...templateOverrides,",
		);
		const lastModuleSpreadIndex = generatedComponents.lastIndexOf(
			"...moduleComponents",
		);
		expect(overrideSpreadIndex).toBeGreaterThan(lastModuleSpreadIndex);
	});

	it("exports the combined components object", () => {
		expect(generatedComponents).toContain("export { components }");
	});

	it("includes the core module list", () => {
		expect(generatedComponents).toContain('"@86d-app/products"');
		expect(generatedComponents).toContain('"@86d-app/cart"');
		expect(generatedComponents).toContain('"@86d-app/orders"');
	});
});
