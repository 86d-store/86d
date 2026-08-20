import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSettingsController } from "../service-impl";

describe("createSettingsController – edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSettingsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSettingsController(mockData);
	});

	// ── Multi-key isolation ─────────────────────────────────────────────

	describe("multi-key isolation", () => {
		it("stores multiple keys independently", async () => {
			await controller.set("general.store_name", "Alpha");
			await controller.set("general.store_description", "Beta");
			await controller.set("general.store_tagline", "Gamma");

			expect(await controller.getValue("general.store_name")).toBe("Alpha");
			expect(await controller.getValue("general.store_description")).toBe(
				"Beta",
			);
			expect(await controller.getValue("general.store_tagline")).toBe("Gamma");
		});

		it("updating one key does not affect another key with similar prefix", async () => {
			await controller.set("general.store", "Value A");
			await controller.set("general.store_name", "Value B");

			await controller.set("general.store", "Updated A");

			expect(await controller.getValue("general.store")).toBe("Updated A");
			expect(await controller.getValue("general.store_name")).toBe("Value B");
		});

		it("deleting one key does not affect other keys", async () => {
			await controller.set("contact.email", "a@b.com");
			await controller.set("contact.phone", "555-0000");
			await controller.set("contact.address", "123 Main St");

			await controller.delete("contact.phone");

			expect(await controller.getValue("contact.email")).toBe("a@b.com");
			expect(await controller.getValue("contact.phone")).toBeNull();
			expect(await controller.getValue("contact.address")).toBe("123 Main St");
		});
	});

	// ── set edge cases ──────────────────────────────────────────────────

	describe("set – edge cases", () => {
		it("handles keys with multiple dots", async () => {
			const setting = await controller.set(
				"general.store.sub.key",
				"deep value",
			);
			expect(setting.group).toBe("general");
			expect(setting.key).toBe("general.store.sub.key");
			expect(setting.value).toBe("deep value");
		});

		it("handles key that is just a dot", async () => {
			const setting = await controller.set(".", "dot value");
			// prefix before "." is empty string, not a valid group
			expect(setting.group).toBe("general");
		});

		it("handles key that starts with a dot", async () => {
			const setting = await controller.set(".leading", "value");
			// prefix is empty string
			expect(setting.group).toBe("general");
		});

		it("handles key with empty string", async () => {
			const setting = await controller.set("", "empty key");
			// no dot in key, split returns [""], not a valid group
			expect(setting.group).toBe("general");
			expect(await controller.getValue("")).toBe("empty key");
		});

		it("handles value with special characters", async () => {
			const specialValue = '<script>alert("xss")</script>';
			const setting = await controller.set(
				"general.test",
				specialValue,
				"general",
			);
			expect(setting.value).toBe(specialValue);
		});

		it("handles value with unicode characters", async () => {
			const unicodeValue =
				"Tienda de ropa - \u00e9l\u00e8ve caf\u00e9 \ud83c\udf1f";
			const setting = await controller.set(
				"general.store_name",
				unicodeValue,
				"general",
			);
			expect(setting.value).toBe(unicodeValue);
		});

		it("handles value with newlines and whitespace", async () => {
			const multiline = "Line 1\nLine 2\n\tIndented\n\nDouble space";
			const setting = await controller.set("legal.tos", multiline, "legal");
			expect(setting.value).toBe(multiline);
		});

		it("generates a new UUID when creating, not when updating", async () => {
			const first = await controller.set("general.key", "v1");
			const second = await controller.set("general.key", "v2");
			expect(first.id).toBe(second.id);

			// But a different key should have a different ID
			const other = await controller.set("general.other", "v3");
			expect(other.id).not.toBe(first.id);
		});

		it("updates the updatedAt timestamp on set", async () => {
			const first = await controller.set("general.key", "v1");
			const firstTime = first.updatedAt.getTime();

			// Small delay to ensure different timestamp
			await new Promise((resolve) => setTimeout(resolve, 5));
			const second = await controller.set("general.key", "v2");
			expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(firstTime);
		});

		it("overrides group even when inferred group would match", async () => {
			// Explicit group same as inferred — should still work
			const setting = await controller.set(
				"contact.email",
				"a@b.com",
				"contact",
			);
			expect(setting.group).toBe("contact");
		});

		it("allows setting a value to the same value (idempotent)", async () => {
			await controller.set("general.store_name", "Same");
			const second = await controller.set("general.store_name", "Same");
			expect(second.value).toBe("Same");
			expect(await controller.getValue("general.store_name")).toBe("Same");
		});
	});

	// ── get edge cases ──────────────────────────────────────────────────

	describe("get – edge cases", () => {
		it("returns null for key with similar prefix to existing key", async () => {
			await controller.set("general.store_name", "Store");
			const result = await controller.get("general.store_name_extra");
			expect(result).toBeNull();
		});

		it("returns the correct setting when many exist", async () => {
			for (let i = 0; i < 50; i++) {
				await controller.set(`general.key_${i}`, `value_${i}`);
			}
			const result = await controller.get("general.key_25");
			expect(result).not.toBeNull();
			expect(result?.value).toBe("value_25");
		});

		it("returns full StoreSetting object with all fields", async () => {
			const created = await controller.set(
				"general.store_name",
				"Full Object",
				"general",
			);
			const fetched = await controller.get("general.store_name");
			expect(fetched).not.toBeNull();
			expect(fetched?.id).toBe(created.id);
			expect(fetched?.key).toBe("general.store_name");
			expect(fetched?.value).toBe("Full Object");
			expect(fetched?.group).toBe("general");
			expect(fetched?.updatedAt).toBeInstanceOf(Date);
		});
	});

	// ── getValue edge cases ─────────────────────────────────────────────

	describe("getValue – edge cases", () => {
		it("returns empty string value (not null) for setting with empty value", async () => {
			await controller.set("general.empty", "");
			const value = await controller.getValue("general.empty");
			expect(value).toBe("");
			expect(value).not.toBeNull();
		});

		it("returns null for a key that was never set", async () => {
			expect(await controller.getValue("nonexistent")).toBeNull();
		});

		it("returns the latest value after multiple updates", async () => {
			await controller.set("general.key", "v1");
			await controller.set("general.key", "v2");
			await controller.set("general.key", "v3");
			expect(await controller.getValue("general.key")).toBe("v3");
		});
	});

	// ── setBulk edge cases ──────────────────────────────────────────────

	describe("setBulk – edge cases", () => {
		it("handles a single-item array", async () => {
			const results = await controller.setBulk([
				{ key: "general.solo", value: "only one" },
			]);
			expect(results).toHaveLength(1);
			expect(results[0].value).toBe("only one");
		});

		it("handles duplicate keys in the same bulk call (last write wins)", async () => {
			const results = await controller.setBulk([
				{ key: "general.dup", value: "first" },
				{ key: "general.dup", value: "second" },
				{ key: "general.dup", value: "third" },
			]);
			expect(results).toHaveLength(3);
			// Each iteration returns the setting as it was set
			expect(results[0].value).toBe("first");
			expect(results[1].value).toBe("second");
			expect(results[2].value).toBe("third");

			// The final stored value should be the last write
			const stored = await controller.getValue("general.dup");
			expect(stored).toBe("third");
		});

		it("preserves IDs for existing keys in bulk", async () => {
			const original = await controller.set("general.name", "Original");
			const results = await controller.setBulk([
				{ key: "general.name", value: "Updated" },
			]);
			expect(results[0].id).toBe(original.id);
		});

		it("bulk creates settings across all group types", async () => {
			const results = await controller.setBulk([
				{ key: "general.a", value: "1" },
				{ key: "contact.b", value: "2" },
				{ key: "social.c", value: "3" },
				{ key: "legal.d", value: "4" },
				{ key: "commerce.e", value: "5" },
				{ key: "appearance.f", value: "6" },
			]);
			expect(results).toHaveLength(6);
			expect(results[0].group).toBe("general");
			expect(results[1].group).toBe("contact");
			expect(results[2].group).toBe("social");
			expect(results[3].group).toBe("legal");
			expect(results[4].group).toBe("commerce");
			expect(results[5].group).toBe("appearance");
		});

		it("bulk handles mixed explicit and inferred groups", async () => {
			const results = await controller.setBulk([
				{ key: "contact.email", value: "a@b.com" },
				{ key: "custom.thing", value: "val", group: "commerce" },
				{ key: "legal.tos", value: "terms" },
			]);
			expect(results[0].group).toBe("contact");
			expect(results[1].group).toBe("commerce");
			expect(results[2].group).toBe("legal");
		});

		it("large bulk operation (50 settings)", async () => {
			const items = Array.from({ length: 50 }, (_, i) => ({
				key: `general.key_${i}`,
				value: `value_${i}`,
			}));
			const results = await controller.setBulk(items);
			expect(results).toHaveLength(50);

			const all = await controller.getAll();
			expect(all).toHaveLength(50);
		});
	});

	// ── getByGroup edge cases ───────────────────────────────────────────

	describe("getByGroup – edge cases", () => {
		it("returns correct count after adds and deletes within a group", async () => {
			await controller.set("contact.email", "a@b.com", "contact");
			await controller.set("contact.phone", "555", "contact");
			await controller.set("contact.address", "123 Main", "contact");

			await controller.delete("contact.phone");

			const results = await controller.getByGroup("contact");
			expect(results).toHaveLength(2);
			const keys = results.map((s) => s.key);
			expect(keys).toContain("contact.email");
			expect(keys).toContain("contact.address");
			expect(keys).not.toContain("contact.phone");
		});

		it("returns settings with explicit group override in their group", async () => {
			// This setting has a "contact." key but forced into "general" group
			await controller.set("contact.email", "a@b.com", "general");
			const general = await controller.getByGroup("general");
			const contact = await controller.getByGroup("contact");

			expect(general.some((s) => s.key === "contact.email")).toBe(true);
			expect(contact.some((s) => s.key === "contact.email")).toBe(false);
		});

		it("returns empty for group after all its settings are deleted", async () => {
			await controller.set("social.fb", "https://fb.com", "social");
			await controller.set("social.ig", "https://ig.com", "social");

			await controller.delete("social.fb");
			await controller.delete("social.ig");

			const results = await controller.getByGroup("social");
			expect(results).toEqual([]);
		});
	});

	// ── getAll edge cases ───────────────────────────────────────────────

	describe("getAll – edge cases", () => {
		it("returns settings from all groups", async () => {
			await controller.setBulk([
				{ key: "general.a", value: "1" },
				{ key: "contact.b", value: "2" },
				{ key: "social.c", value: "3" },
				{ key: "legal.d", value: "4" },
				{ key: "commerce.e", value: "5" },
				{ key: "appearance.f", value: "6" },
			]);

			const all = await controller.getAll();
			expect(all).toHaveLength(6);
			const groups = new Set(all.map((s) => s.group));
			expect(groups.size).toBe(6);
		});

		it("reflects deletions in subsequent calls", async () => {
			await controller.set("general.a", "1");
			await controller.set("general.b", "2");
			expect(await controller.getAll()).toHaveLength(2);

			await controller.delete("general.a");
			expect(await controller.getAll()).toHaveLength(1);
		});

		it("reflects updates (no duplicates) in subsequent calls", async () => {
			await controller.set("general.a", "v1");
			await controller.set("general.a", "v2");
			const all = await controller.getAll();
			expect(all).toHaveLength(1);
			expect(all[0].value).toBe("v2");
		});
	});

	// ── getPublic edge cases ────────────────────────────────────────────

	describe("getPublic – edge cases", () => {
		it("includes all four public prefixes", async () => {
			await controller.set("general.name", "Store");
			await controller.set("contact.email", "a@b.com");
			await controller.set("social.twitter", "https://tw.com");
			await controller.set("appearance.color", "#fff");

			const pub = await controller.getPublic();
			expect(Object.keys(pub)).toHaveLength(4);
			expect(pub["general.name"]).toBe("Store");
			expect(pub["contact.email"]).toBe("a@b.com");
			expect(pub["social.twitter"]).toBe("https://tw.com");
			expect(pub["appearance.color"]).toBe("#fff");
		});

		it("excludes legal and commerce groups", async () => {
			await controller.set("legal.tos", "Terms");
			await controller.set("commerce.currency", "USD");

			const pub = await controller.getPublic();
			expect(Object.keys(pub)).toHaveLength(0);
		});

		it("filters by key prefix not by group field", async () => {
			// A setting with key "legal.tos" but group forced to "general"
			// should still be excluded because getPublic filters on key prefix
			await controller.set("legal.tos", "Terms", "general");
			const pub = await controller.getPublic();
			expect(pub["legal.tos"]).toBeUndefined();
		});

		it("includes setting with key 'general.x' even if group is overridden", async () => {
			// Key has public prefix "general.", so it should be public
			await controller.set("general.name", "Store", "commerce");
			const pub = await controller.getPublic();
			expect(pub["general.name"]).toBe("Store");
		});

		it("excludes keys with non-public prefix even with similar start", async () => {
			// "generally." is not the same as "general."
			await controller.set("generally.thing", "value");
			const pub = await controller.getPublic();
			expect(pub["generally.thing"]).toBeUndefined();
		});

		it("handles large number of settings efficiently", async () => {
			const items: Array<{ key: string; value: string }> = [];
			for (let i = 0; i < 100; i++) {
				const group = i % 2 === 0 ? "general" : "commerce";
				items.push({
					key: `${group}.key_${i}`,
					value: `val_${i}`,
				});
			}
			await controller.setBulk(items);

			const pub = await controller.getPublic();
			// Only general. prefix keys are public (50 even indices)
			expect(Object.keys(pub)).toHaveLength(50);
		});

		it("returns latest value after update for public keys", async () => {
			await controller.set("general.name", "Old Name");
			await controller.set("general.name", "New Name");
			const pub = await controller.getPublic();
			expect(pub["general.name"]).toBe("New Name");
		});

		it("omits deleted public settings", async () => {
			await controller.set("general.name", "Store");
			await controller.delete("general.name");
			const pub = await controller.getPublic();
			expect(pub["general.name"]).toBeUndefined();
			expect(Object.keys(pub)).toHaveLength(0);
		});
	});

	// ── delete edge cases ───────────────────────────────────────────────

	describe("delete – edge cases", () => {
		it("returns false when deleting the same key twice", async () => {
			await controller.set("general.key", "val");
			expect(await controller.delete("general.key")).toBe(true);
			expect(await controller.delete("general.key")).toBe(false);
		});

		it("returns false for key that was never created", async () => {
			expect(await controller.delete("never.existed")).toBe(false);
		});

		it("only deletes the exact key match", async () => {
			await controller.set("general.store", "A");
			await controller.set("general.store_name", "B");

			await controller.delete("general.store");
			expect(await controller.getValue("general.store")).toBeNull();
			expect(await controller.getValue("general.store_name")).toBe("B");
		});

		it("allows re-creation after delete with new value", async () => {
			const original = await controller.set("general.key", "original");
			await controller.delete("general.key");
			const recreated = await controller.set("general.key", "recreated");

			expect(recreated.value).toBe("recreated");
			// ID should be new since the old record was deleted
			expect(recreated.id).not.toBe(original.id);
		});

		it("properly removes from data store (not just from findMany results)", async () => {
			const setting = await controller.set("general.key", "val");
			await controller.delete("general.key");

			// Check that the underlying data store no longer has the entry
			expect(mockData.size("storeSetting")).toBe(0);
			const raw = await mockData.get("storeSetting", setting.id);
			expect(raw).toBeNull();
		});
	});

	// ── groupFromKey inference edge cases ────────────────────────────────

	describe("groupFromKey inference", () => {
		it("infers all six valid group prefixes", async () => {
			const cases = [
				{ key: "general.x", expected: "general" },
				{ key: "contact.x", expected: "contact" },
				{ key: "social.x", expected: "social" },
				{ key: "legal.x", expected: "legal" },
				{ key: "commerce.x", expected: "commerce" },
				{ key: "appearance.x", expected: "appearance" },
			] as const;

			for (const { key, expected } of cases) {
				const setting = await controller.set(key, "value");
				expect(setting.group).toBe(expected);
			}
		});

		it("defaults to general for unknown prefix", async () => {
			const unknowns = [
				"custom.key",
				"foo.bar",
				"admin.setting",
				"store.key",
				"system.config",
			];

			for (const key of unknowns) {
				const setting = await controller.set(key, "val");
				expect(setting.group).toBe("general");
			}
		});

		it("handles case sensitivity (groups are lowercase only)", async () => {
			const setting = await controller.set("General.store_name", "Test");
			// "General" !== "general" so it defaults to "general"
			expect(setting.group).toBe("general");
		});

		it("handles key without any dot", async () => {
			const setting = await controller.set("nodot", "val");
			// split(".")[0] is "nodot" which is not a valid group
			expect(setting.group).toBe("general");
		});
	});

	// ── data store interaction edge cases ────────────────────────────────

	describe("data store interaction", () => {
		it("uses storeSetting entity type consistently", async () => {
			await controller.set("general.key", "val");
			expect(mockData.size("storeSetting")).toBe(1);
			expect(mockData.size("setting")).toBe(0);
			expect(mockData.size("storeSettings")).toBe(0);
		});

		it("data store has correct shape after set", async () => {
			const setting = await controller.set("general.key", "val");
			const raw = await mockData.get("storeSetting", setting.id);
			expect(raw).not.toBeNull();
			expect(raw?.key).toBe("general.key");
			expect(raw?.value).toBe("val");
			expect(raw?.group).toBe("general");
			expect(raw?.id).toBe(setting.id);
		});

		it("clearing the data store makes getAll return empty", async () => {
			await controller.set("general.a", "1");
			await controller.set("contact.b", "2");
			expect(await controller.getAll()).toHaveLength(2);

			mockData.clear();
			expect(await controller.getAll()).toHaveLength(0);
		});
	});

	// ── concurrent / sequential operation patterns ──────────────────────

	describe("sequential operations", () => {
		it("set then immediately get returns the value", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.set(`general.key_${i}`, `val_${i}`);
				const value = await controller.getValue(`general.key_${i}`);
				expect(value).toBe(`val_${i}`);
			}
		});

		it("interleaved sets and deletes maintain consistency", async () => {
			await controller.set("general.a", "1");
			await controller.set("general.b", "2");
			await controller.delete("general.a");
			await controller.set("general.c", "3");
			await controller.delete("general.b");
			await controller.set("general.a", "4"); // re-create

			const all = await controller.getAll();
			expect(all).toHaveLength(2);
			const keys = all.map((s) => s.key).sort();
			expect(keys).toEqual(["general.a", "general.c"]);
			expect(await controller.getValue("general.a")).toBe("4");
			expect(await controller.getValue("general.b")).toBeNull();
			expect(await controller.getValue("general.c")).toBe("3");
		});

		it("setBulk followed by getByGroup returns correct settings", async () => {
			await controller.setBulk([
				{ key: "contact.email", value: "a@b.com" },
				{ key: "contact.phone", value: "555" },
				{ key: "general.name", value: "Store" },
			]);

			const contact = await controller.getByGroup("contact");
			expect(contact).toHaveLength(2);

			const general = await controller.getByGroup("general");
			expect(general).toHaveLength(1);
		});

		it("delete after setBulk works correctly", async () => {
			await controller.setBulk([
				{ key: "general.a", value: "1" },
				{ key: "general.b", value: "2" },
				{ key: "general.c", value: "3" },
			]);

			await controller.delete("general.b");

			const all = await controller.getAll();
			expect(all).toHaveLength(2);
			expect(all.map((s) => s.key).sort()).toEqual(["general.a", "general.c"]);
		});
	});

	// ── SETTING_KEYS constants integration ──────────────────────────────

	describe("SETTING_KEYS integration", () => {
		it("all SETTING_KEYS resolve to the correct groups", async () => {
			const keyGroupPairs = [
				{ key: "general.store_name", group: "general" },
				{ key: "general.store_description", group: "general" },
				{ key: "contact.support_email", group: "contact" },
				{ key: "contact.business_address", group: "contact" },
				{ key: "social.facebook", group: "social" },
				{ key: "social.instagram", group: "social" },
				{ key: "legal.return_policy", group: "legal" },
				{ key: "legal.privacy_policy", group: "legal" },
				{ key: "commerce.currency", group: "commerce" },
				{ key: "commerce.weight_unit", group: "commerce" },
				{ key: "appearance.logo_url", group: "appearance" },
				{ key: "appearance.brand_color", group: "appearance" },
			] as const;

			for (const { key, group } of keyGroupPairs) {
				const setting = await controller.set(key, "test_value");
				expect(setting.group).toBe(group);
			}
		});

		it("public setting keys from general/contact/social/appearance are public", async () => {
			await controller.setBulk([
				{ key: "general.store_name", value: "My Store" },
				{ key: "contact.support_email", value: "help@store.com" },
				{ key: "social.facebook", value: "https://fb.com" },
				{ key: "appearance.logo_url", value: "/logo.png" },
				{ key: "legal.return_policy", value: "No returns" },
				{ key: "commerce.currency", value: "USD" },
			]);

			const pub = await controller.getPublic();
			expect(pub["general.store_name"]).toBe("My Store");
			expect(pub["contact.support_email"]).toBe("help@store.com");
			expect(pub["social.facebook"]).toBe("https://fb.com");
			expect(pub["appearance.logo_url"]).toBe("/logo.png");
			expect(pub["legal.return_policy"]).toBeUndefined();
			expect(pub["commerce.currency"]).toBeUndefined();
		});
	});

	// ── findMany / pagination behavior ──────────────────────────────────

	describe("findMany / pagination behavior", () => {
		it("get uses take:1 to fetch a single result", async () => {
			// Manually seed two settings with the same key in the store
			// (simulating a data integrity edge case)
			const id1 = "id-1";
			const id2 = "id-2";
			await mockData.upsert("storeSetting", id1, {
				id: id1,
				key: "general.name",
				value: "First",
				group: "general",
				updatedAt: new Date(),
			});
			await mockData.upsert("storeSetting", id2, {
				id: id2,
				key: "general.name",
				value: "Second",
				group: "general",
				updatedAt: new Date(),
			});

			// get should return exactly one result (take:1)
			const result = await controller.get("general.name");
			expect(result).not.toBeNull();
			// It should be one of the two
			expect(["First", "Second"]).toContain(result?.value);
		});

		it("getAll returns all settings without pagination limits", async () => {
			for (let i = 0; i < 100; i++) {
				await controller.set(`general.key_${i}`, `val_${i}`);
			}
			const all = await controller.getAll();
			expect(all).toHaveLength(100);
		});

		it("getByGroup returns all settings for a group without limits", async () => {
			for (let i = 0; i < 30; i++) {
				await controller.set(`contact.field_${i}`, `val_${i}`, "contact");
			}
			const contact = await controller.getByGroup("contact");
			expect(contact).toHaveLength(30);
		});
	});

	// ── default value behavior ──────────────────────────────────────────

	describe("default value behavior", () => {
		it("getValue returns null (no default) for missing keys", async () => {
			// The controller does not support default values at the getValue level
			const value = await controller.getValue("general.nonexistent");
			expect(value).toBeNull();
		});

		it("get returns null (no default object) for missing keys", async () => {
			const setting = await controller.get("general.nonexistent");
			expect(setting).toBeNull();
		});

		it("getPublic returns empty object when all settings are non-public", async () => {
			await controller.set("commerce.currency", "USD");
			await controller.set("legal.tos", "Terms");
			const pub = await controller.getPublic();
			expect(pub).toEqual({});
		});
	});

	// ── type coercion edge cases ────────────────────────────────────────

	describe("type coercion edge cases", () => {
		it("stores numeric strings as strings", async () => {
			await controller.set("commerce.tax_rate", "0.08");
			const value = await controller.getValue("commerce.tax_rate");
			expect(value).toBe("0.08");
			expect(typeof value).toBe("string");
		});

		it("stores boolean-like strings as strings", async () => {
			await controller.set("commerce.tax_included", "true");
			const value = await controller.getValue("commerce.tax_included");
			expect(value).toBe("true");
			expect(typeof value).toBe("string");
		});

		it("stores JSON strings as strings", async () => {
			const json = JSON.stringify({ theme: "dark", colors: ["#fff", "#000"] });
			await controller.set("appearance.config", json);
			const value = await controller.getValue("appearance.config");
			expect(value).toBe(json);
			expect(JSON.parse(value as string)).toEqual({
				theme: "dark",
				colors: ["#fff", "#000"],
			});
		});

		it("stores null-like string as string", async () => {
			await controller.set("general.test", "null");
			const value = await controller.getValue("general.test");
			expect(value).toBe("null");
			expect(value).not.toBeNull();
		});

		it("stores undefined-like string as string", async () => {
			await controller.set("general.test", "undefined");
			const value = await controller.getValue("general.test");
			expect(value).toBe("undefined");
		});

		it("stores zero string as string", async () => {
			await controller.set("general.count", "0");
			const value = await controller.getValue("general.count");
			expect(value).toBe("0");
			expect(value).not.toBe(0);
		});
	});
});
