import { describe, expect, it } from "vitest";
import { isOfficialModule, parseSpecifier } from "../specifier.js";

describe("parseSpecifier", () => {
	describe("official modules", () => {
		it("parses bare name to registry specifier", () => {
			const spec = parseSpecifier("products");
			expect(spec.source).toBe("registry");
			expect(spec.name).toBe("products");
			expect(spec.packageName).toBe("@86d-app/products");
		});

		it("parses @86d-app/ prefixed name", () => {
			const spec = parseSpecifier("@86d-app/cart");
			expect(spec.source).toBe("registry");
			expect(spec.name).toBe("cart");
			expect(spec.packageName).toBe("@86d-app/cart");
		});

		it("handles hyphenated names", () => {
			const spec = parseSpecifier("digital-downloads");
			expect(spec.name).toBe("digital-downloads");
			expect(spec.packageName).toBe("@86d-app/digital-downloads");
		});
	});

	describe("GitHub specifiers", () => {
		it("parses basic owner/repo", () => {
			const spec = parseSpecifier("github:owner/repo");
			expect(spec.source).toBe("github");
			expect(spec.repo).toBe("owner/repo");
			expect(spec.name).toBe("repo");
			expect(spec.ref).toBe("main");
			expect(spec.path).toBeUndefined();
		});

		it("parses owner/repo with subpath", () => {
			const spec = parseSpecifier("github:owner/repo/modules/custom");
			expect(spec.source).toBe("github");
			expect(spec.repo).toBe("owner/repo");
			expect(spec.path).toBe("modules/custom");
			expect(spec.name).toBe("custom");
			expect(spec.ref).toBe("main");
		});

		it("parses owner/repo with ref", () => {
			const spec = parseSpecifier("github:owner/repo/modules/custom#v2.0");
			expect(spec.source).toBe("github");
			expect(spec.repo).toBe("owner/repo");
			expect(spec.path).toBe("modules/custom");
			expect(spec.ref).toBe("v2.0");
		});

		it("throws on invalid GitHub specifier", () => {
			expect(() => parseSpecifier("github:invalid")).toThrow(
				/expected at least "owner\/repo"/,
			);
		});
	});

	describe("npm specifiers", () => {
		it("parses scoped package", () => {
			const spec = parseSpecifier("npm:@acme/commerce-module");
			expect(spec.source).toBe("npm");
			expect(spec.packageName).toBe("@acme/commerce-module");
			expect(spec.name).toBe("commerce-module");
			expect(spec.version).toBe("latest");
		});

		it("parses scoped package with version", () => {
			const spec = parseSpecifier("npm:@acme/commerce-module@^1.0.0");
			expect(spec.source).toBe("npm");
			expect(spec.packageName).toBe("@acme/commerce-module");
			expect(spec.version).toBe("^1.0.0");
		});

		it("parses unscoped package", () => {
			const spec = parseSpecifier("npm:my-module");
			expect(spec.source).toBe("npm");
			expect(spec.packageName).toBe("my-module");
			expect(spec.name).toBe("my-module");
			expect(spec.version).toBe("latest");
		});

		it("parses unscoped package with version", () => {
			const spec = parseSpecifier("npm:my-module@2.0.0");
			expect(spec.source).toBe("npm");
			expect(spec.packageName).toBe("my-module");
			expect(spec.version).toBe("2.0.0");
		});
	});

	it("preserves raw specifier", () => {
		const spec = parseSpecifier("github:owner/repo/modules/custom#v2");
		expect(spec.raw).toBe("github:owner/repo/modules/custom#v2");
	});
});

describe("isOfficialModule", () => {
	it("returns true for registry source", () => {
		const spec = parseSpecifier("products");
		expect(isOfficialModule(spec)).toBe(true);
	});

	it("returns false for github source", () => {
		const spec = parseSpecifier("github:owner/repo");
		expect(isOfficialModule(spec)).toBe(false);
	});

	it("returns false for npm source", () => {
		const spec = parseSpecifier("npm:my-module");
		expect(isOfficialModule(spec)).toBe(false);
	});
});
