import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadFromTemplate } from "../load-from-template";
import { DEFAULT_CONFIG } from "../types";

const TMP_DIR = join(import.meta.dirname, "__tmp_template_test__");

beforeAll(() => {
	mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
	if (existsSync(TMP_DIR)) {
		rmSync(TMP_DIR, { recursive: true });
	}
});

describe("loadFromTemplate", () => {
	it("loads and parses a valid config.json", () => {
		const configPath = join(TMP_DIR, "valid-config.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				theme: "custom",
				name: "My Store",
				favicon: "/favicon.ico",
			}),
		);

		const result = loadFromTemplate(configPath);
		expect(result.theme).toBe("custom");
		expect(result.name).toBe("My Store");
		expect(result.favicon).toBe("/favicon.ico");
	});

	it("merges with DEFAULT_CONFIG defaults", () => {
		const configPath = join(TMP_DIR, "partial-config.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				theme: "minimal",
				name: "Partial Store",
			}),
		);

		const result = loadFromTemplate(configPath);
		// Should have defaults for icon/logo from DEFAULT_CONFIG
		expect(result.icon).toEqual(DEFAULT_CONFIG.icon);
		expect(result.logo).toEqual(DEFAULT_CONFIG.logo);
		expect(result.variables.light.background).toBe(
			DEFAULT_CONFIG.variables.light.background,
		);
	});

	it("overrides default variables with template variables", () => {
		const configPath = join(TMP_DIR, "themed-config.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				theme: "dark-theme",
				name: "Dark Store",
				variables: {
					light: {
						background: "oklch(0.95 0 0)",
					},
				},
			}),
		);

		const result = loadFromTemplate(configPath);
		expect(result.variables.light.background).toBe("oklch(0.95 0 0)");
		// Other light variables should be defaults
		expect(result.variables.light.foreground).toBe(
			DEFAULT_CONFIG.variables.light.foreground,
		);
		// Dark variables should be defaults
		expect(result.variables.dark.background).toBe(
			DEFAULT_CONFIG.variables.dark.background,
		);
	});

	it("overrides icon and logo", () => {
		const configPath = join(TMP_DIR, "branded-config.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				theme: "branded",
				name: "Branded Store",
				icon: { light: "/brand-icon-light.svg" },
				logo: { dark: "/brand-logo-dark.svg" },
			}),
		);

		const result = loadFromTemplate(configPath);
		expect(result.icon.light).toBe("/brand-icon-light.svg");
		expect(result.icon.dark).toBe(DEFAULT_CONFIG.icon.dark);
		expect(result.logo.dark).toBe("/brand-logo-dark.svg");
		expect(result.logo.light).toBe(DEFAULT_CONFIG.logo.light);
	});

	it("preserves Store-owned Module and notification settings for standalone templates", () => {
		const configPath = join(TMP_DIR, "store-owned-settings.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				theme: "standalone",
				name: "Standalone Store",
				moduleOptions: {
					"@86d-app/cart": { maxItemsPerCart: 25 },
				},
				notificationSettings: {
					fromAddress: "Store <orders@example.com>",
					adminEmail: "owner@example.com",
					events: { "order.placed": true },
				},
			}),
		);

		const result = loadFromTemplate(configPath);

		expect(result.moduleOptions).toEqual({
			"@86d-app/cart": { maxItemsPerCart: 25 },
		});
		expect(result.notificationSettings).toEqual({
			fromAddress: "Store <orders@example.com>",
			adminEmail: "owner@example.com",
			events: { "order.placed": true },
		});
	});

	it("throws for non-existent file", () => {
		expect(() => loadFromTemplate("/nonexistent/config.json")).toThrow();
	});

	it("throws for invalid JSON", () => {
		const configPath = join(TMP_DIR, "invalid.json");
		writeFileSync(configPath, "not valid json{{{");
		expect(() => loadFromTemplate(configPath)).toThrow();
	});
});
