import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../types";

describe("DEFAULT_CONFIG", () => {
	it("has required top-level fields", () => {
		expect(DEFAULT_CONFIG.theme).toBe("brisa");
		expect(DEFAULT_CONFIG.name).toBe("86d Starter Kit");
		expect(DEFAULT_CONFIG.favicon).toBeTypeOf("string");
	});

	it("has icon with light and dark variants", () => {
		expect(DEFAULT_CONFIG.icon.light).toBeTypeOf("string");
		expect(DEFAULT_CONFIG.icon.dark).toBeTypeOf("string");
	});

	it("has logo with light and dark variants", () => {
		expect(DEFAULT_CONFIG.logo.light).toBeTypeOf("string");
		expect(DEFAULT_CONFIG.logo.dark).toBeTypeOf("string");
	});

	it("has light and dark theme variables", () => {
		expect(DEFAULT_CONFIG.variables.light).toBeDefined();
		expect(DEFAULT_CONFIG.variables.dark).toBeDefined();
	});

	it("has OKLCH color values in theme variables", () => {
		expect(DEFAULT_CONFIG.variables.light.background).toContain("oklch");
		expect(DEFAULT_CONFIG.variables.dark.background).toContain("oklch");
	});

	it("has all required theme variable keys", () => {
		const requiredKeys = [
			"background",
			"foreground",
			"card",
			"card-foreground",
			"primary",
			"primary-foreground",
			"secondary",
			"secondary-foreground",
			"muted",
			"muted-foreground",
			"accent",
			"accent-foreground",
			"destructive",
			"border",
			"input",
			"ring",
		];
		for (const key of requiredKeys) {
			expect(
				DEFAULT_CONFIG.variables.light[
					key as keyof typeof DEFAULT_CONFIG.variables.light
				],
			).toBeDefined();
			expect(
				DEFAULT_CONFIG.variables.dark[
					key as keyof typeof DEFAULT_CONFIG.variables.dark
				],
			).toBeDefined();
		}
	});

	it("includes sidebar theme variables", () => {
		expect(DEFAULT_CONFIG.variables.light.sidebar).toBeDefined();
		expect(DEFAULT_CONFIG.variables.light["sidebar-foreground"]).toBeDefined();
		expect(DEFAULT_CONFIG.variables.dark.sidebar).toBeDefined();
	});

	it("includes chart color variables", () => {
		expect(DEFAULT_CONFIG.variables.light["chart-1"]).toBeDefined();
		expect(DEFAULT_CONFIG.variables.light["chart-5"]).toBeDefined();
	});

	it("has default modules array", () => {
		expect(DEFAULT_CONFIG.modules).toEqual(["@86d-app/cart"]);
	});
});
