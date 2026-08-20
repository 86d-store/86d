import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSettingsController } from "../service-impl";

/**
 * Store endpoint integration tests for the settings module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-public: returns public store settings
 * 2. get-value: returns a single setting value by key
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateGetPublic(data: DataService) {
	const controller = createSettingsController(data);
	const settings = await controller.getPublic();
	return { settings };
}

async function simulateGetValue(data: DataService, key: string) {
	const controller = createSettingsController(data);
	const value = await controller.getValue(key);
	if (value === null) {
		return { error: "Setting not found", status: 404 };
	}
	return { value };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: get public settings", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns public settings", async () => {
		const ctrl = createSettingsController(data);
		await ctrl.set("general.store_name", "My Store", "general");
		await ctrl.set("general.store_tagline", "Best shop", "general");

		const result = await simulateGetPublic(data);

		expect(result.settings).toBeDefined();
		expect(result.settings["general.store_name"]).toBe("My Store");
		expect(result.settings["general.store_tagline"]).toBe("Best shop");
	});

	it("returns empty when no public settings", async () => {
		const result = await simulateGetPublic(data);

		expect(result.settings).toBeDefined();
		expect(Object.keys(result.settings)).toHaveLength(0);
	});
});

describe("store endpoint: get value — single setting", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns a setting value", async () => {
		const ctrl = createSettingsController(data);
		await ctrl.set("theme_color", "#ff0000");

		const result = await simulateGetValue(data, "theme_color");

		expect("value" in result).toBe(true);
		if ("value" in result) {
			expect(result.value).toBe("#ff0000");
		}
	});

	it("returns 404 for nonexistent setting", async () => {
		const result = await simulateGetValue(data, "nonexistent_key");

		expect(result).toEqual({ error: "Setting not found", status: 404 });
	});
});
