import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	getModuleOptions,
	normalizeModulesField,
	readStoreConfig,
} from "../config.js";

const TMP_DIR = join(import.meta.dirname, ".tmp-config-test");

beforeAll(() => {
	mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
	rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("readStoreConfig", () => {
	it("reads a valid config file", () => {
		const configPath = join(TMP_DIR, "valid.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				theme: "brisa",
				modules: "*",
				moduleOptions: { "@86d-app/cart": { maxItems: 100 } },
			}),
		);

		const config = readStoreConfig(configPath);
		expect(config.theme).toBe("brisa");
		expect(config.modules).toBe("*");
		expect(config.moduleOptions?.["@86d-app/cart"]).toEqual({
			maxItems: 100,
		});
	});

	it("throws on missing file", () => {
		expect(() => readStoreConfig(join(TMP_DIR, "nonexistent.json"))).toThrow(
			/not found/,
		);
	});
});

describe("normalizeModulesField", () => {
	it('returns "*" for undefined', () => {
		expect(normalizeModulesField(undefined)).toBe("*");
	});

	it('returns "*" for "*"', () => {
		expect(normalizeModulesField("*")).toBe("*");
	});

	it("returns array as-is", () => {
		const modules = ["@86d-app/products", "@86d-app/cart"];
		expect(normalizeModulesField(modules)).toEqual(modules);
	});
});

describe("getModuleOptions", () => {
	it("returns options for a module", () => {
		const config = {
			moduleOptions: {
				"@86d-app/cart": { maxItems: 100, guestExpiry: 86400 },
			},
		};
		const opts = getModuleOptions(config, "@86d-app/cart");
		expect(opts).toEqual({ maxItems: 100, guestExpiry: 86400 });
	});

	it("returns empty object for unknown module", () => {
		const config = { moduleOptions: {} };
		expect(getModuleOptions(config, "@86d-app/unknown")).toEqual({});
	});

	it("returns empty object when no moduleOptions", () => {
		const config = {};
		expect(getModuleOptions(config, "@86d-app/cart")).toEqual({});
	});
});
