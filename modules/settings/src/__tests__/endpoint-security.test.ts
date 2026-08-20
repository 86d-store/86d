import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { SettingGroup } from "../service";
import { createSettingsController } from "../service-impl";

/**
 * Security regression tests for settings endpoints.
 *
 * Settings contain store configuration that, if leaked or tampered
 * with, could expose sensitive data or break commerce operations.
 * These tests verify:
 *
 * 1. Group isolation: getByGroup never leaks cross-group settings
 * 2. Public/private boundary: getPublic excludes legal & commerce
 * 3. Key uniqueness: duplicate keys within a namespace resolve correctly
 * 4. Value type enforcement: all values stored and returned as strings
 * 5. Sensitive setting masking: legal/commerce never exposed publicly
 * 6. Bulk update atomicity: partial failures don't corrupt state
 * 7. Delete isolation: removing one key never affects siblings
 */

describe("settings endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSettingsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSettingsController(mockData);
	});

	// ── Group Isolation ──────────────────────────────────────────────

	describe("group isolation", () => {
		it("getByGroup never returns settings from other groups", async () => {
			await controller.set("general.store_name", "Shop", "general");
			await controller.set("contact.email", "a@b.com", "contact");
			await controller.set("commerce.currency", "USD", "commerce");
			await controller.set("legal.tos", "Terms text", "legal");
			await controller.set("social.twitter", "@shop", "social");
			await controller.set("appearance.brand_color", "#000", "appearance");

			const groups: SettingGroup[] = [
				"general",
				"contact",
				"commerce",
				"legal",
				"social",
				"appearance",
			];

			for (const group of groups) {
				const results = await controller.getByGroup(group);
				for (const s of results) {
					expect(s.group).toBe(group);
				}
			}
		});

		it("setting with key prefix of one group forced into another stays in the forced group", async () => {
			// key prefix says "contact" but group is forced to "commerce"
			await controller.set("contact.secret_api_key", "sk_live_123", "commerce");

			const contact = await controller.getByGroup("contact");
			expect(contact).toHaveLength(0);

			const commerce = await controller.getByGroup("commerce");
			expect(commerce).toHaveLength(1);
			expect(commerce[0].key).toBe("contact.secret_api_key");
		});

		it("getByGroup returns empty array for valid group with no settings", async () => {
			await controller.set("general.name", "Store");
			const legal = await controller.getByGroup("legal");
			expect(legal).toEqual([]);
		});
	});

	// ── Public / Private Boundary ────────────────────────────────────

	describe("public / private boundary", () => {
		it("getPublic excludes commerce settings", async () => {
			await controller.set("commerce.currency", "USD");
			await controller.set("commerce.order_prefix", "ORD-");
			await controller.set("commerce.tax_included", "true");

			const pub = await controller.getPublic();
			expect(pub["commerce.currency"]).toBeUndefined();
			expect(pub["commerce.order_prefix"]).toBeUndefined();
			expect(pub["commerce.tax_included"]).toBeUndefined();
			expect(Object.keys(pub)).toHaveLength(0);
		});

		it("getPublic excludes legal settings", async () => {
			await controller.set("legal.return_policy", "No returns");
			await controller.set("legal.privacy_policy", "We collect data");
			await controller.set("legal.terms_of_service", "Agree to all");

			const pub = await controller.getPublic();
			expect(pub["legal.return_policy"]).toBeUndefined();
			expect(pub["legal.privacy_policy"]).toBeUndefined();
			expect(pub["legal.terms_of_service"]).toBeUndefined();
		});

		it("getPublic includes general, contact, social, appearance", async () => {
			await controller.set("general.store_name", "My Shop");
			await controller.set("contact.support_email", "help@shop.com");
			await controller.set("social.instagram", "https://ig.com/shop");
			await controller.set("appearance.logo_url", "/logo.png");

			const pub = await controller.getPublic();
			expect(Object.keys(pub)).toHaveLength(4);
			expect(pub["general.store_name"]).toBe("My Shop");
			expect(pub["contact.support_email"]).toBe("help@shop.com");
			expect(pub["social.instagram"]).toBe("https://ig.com/shop");
			expect(pub["appearance.logo_url"]).toBe("/logo.png");
		});

		it("getPublic filters by key prefix, not group field", async () => {
			// Force a legal-prefixed key into the "general" group
			await controller.set("legal.secret_clause", "hidden", "general");

			const pub = await controller.getPublic();
			// Key starts with "legal." so it must not appear in public
			expect(pub["legal.secret_clause"]).toBeUndefined();
		});

		it("getPublic rejects near-miss prefixes", async () => {
			// "generally." is not "general."
			await controller.set("generally.store_info", "leaked");
			// "contacts." is not "contact."
			await controller.set("contacts.email", "leaked@leak.com");

			const pub = await controller.getPublic();
			expect(pub["generally.store_info"]).toBeUndefined();
			expect(pub["contacts.email"]).toBeUndefined();
		});
	});

	// ── Key Uniqueness per Namespace ─────────────────────────────────

	describe("key uniqueness per namespace", () => {
		it("set overwrites the same key rather than creating duplicates", async () => {
			await controller.set("general.store_name", "Store A");
			await controller.set("general.store_name", "Store B");
			await controller.set("general.store_name", "Store C");

			const all = await controller.getAll();
			const nameSettings = all.filter((s) => s.key === "general.store_name");
			expect(nameSettings).toHaveLength(1);
			expect(nameSettings[0].value).toBe("Store C");
		});

		it("set preserves the original id on update", async () => {
			const first = await controller.set("general.store_name", "Original");
			const second = await controller.set("general.store_name", "Updated");
			expect(second.id).toBe(first.id);
		});

		it("similar key prefixes do not collide", async () => {
			await controller.set("general.store", "A");
			await controller.set("general.store_name", "B");
			await controller.set("general.store_name_long", "C");

			expect(await controller.getValue("general.store")).toBe("A");
			expect(await controller.getValue("general.store_name")).toBe("B");
			expect(await controller.getValue("general.store_name_long")).toBe("C");

			const all = await controller.getAll();
			expect(all).toHaveLength(3);
		});
	});

	// ── Value Type Enforcement ───────────────────────────────────────

	describe("value type enforcement", () => {
		it("numeric values are stored and returned as strings", async () => {
			await controller.set("commerce.tax_rate", "0.08");
			const value = await controller.getValue("commerce.tax_rate");
			expect(value).toBe("0.08");
			expect(typeof value).toBe("string");
		});

		it("boolean-like values are stored as strings", async () => {
			await controller.set("commerce.tax_included", "true");
			const value = await controller.getValue("commerce.tax_included");
			expect(value).toBe("true");
			expect(typeof value).toBe("string");
		});

		it("JSON values are stored as raw strings without parsing", async () => {
			const json = JSON.stringify({
				primary: "#000",
				secondary: "#fff",
			});
			await controller.set("appearance.theme_config", json);
			const value = await controller.getValue("appearance.theme_config");
			expect(value).toBe(json);
			expect(typeof value).toBe("string");
		});

		it("XSS payload is stored verbatim without sanitization", async () => {
			const xss = '<script>alert("xss")</script>';
			await controller.set("general.store_name", xss);
			const value = await controller.getValue("general.store_name");
			// Controller stores raw value; sanitization is the endpoint's job
			expect(value).toBe(xss);
		});

		it("empty string is a valid value (not treated as null)", async () => {
			await controller.set("general.store_name", "");
			const value = await controller.getValue("general.store_name");
			expect(value).toBe("");
			expect(value).not.toBeNull();
		});

		it("null-like and undefined-like strings are stored as strings", async () => {
			await controller.set("general.a", "null");
			await controller.set("general.b", "undefined");

			expect(await controller.getValue("general.a")).toBe("null");
			expect(await controller.getValue("general.b")).toBe("undefined");
		});
	});

	// ── Sensitive Setting Masking ────────────────────────────────────

	describe("sensitive setting masking via getPublic", () => {
		it("mixed public and private settings only expose public ones", async () => {
			await controller.setBulk([
				{ key: "general.store_name", value: "My Shop" },
				{ key: "commerce.stripe_key", value: "sk_live_secret" },
				{ key: "legal.terms_of_service", value: "Binding terms" },
				{ key: "contact.support_email", value: "help@shop.com" },
				{ key: "social.facebook", value: "https://fb.com/shop" },
				{
					key: "appearance.brand_color",
					value: "#ff6600",
				},
			]);

			const pub = await controller.getPublic();
			// Public (4 keys)
			expect(pub["general.store_name"]).toBe("My Shop");
			expect(pub["contact.support_email"]).toBe("help@shop.com");
			expect(pub["social.facebook"]).toBe("https://fb.com/shop");
			expect(pub["appearance.brand_color"]).toBe("#ff6600");
			// Private (must not appear)
			expect(pub["commerce.stripe_key"]).toBeUndefined();
			expect(pub["legal.terms_of_service"]).toBeUndefined();
			expect(Object.keys(pub)).toHaveLength(4);
		});

		it("getAll still returns all settings including private ones", async () => {
			await controller.set("commerce.api_secret", "sk_secret_123");
			await controller.set("legal.internal_notes", "Do not share");
			await controller.set("general.store_name", "Public Shop");

			const all = await controller.getAll();
			expect(all).toHaveLength(3);
			const keys = all.map((s) => s.key);
			expect(keys).toContain("commerce.api_secret");
			expect(keys).toContain("legal.internal_notes");
			expect(keys).toContain("general.store_name");
		});
	});

	// ── Bulk Update Atomicity ────────────────────────────────────────

	describe("bulk update atomicity", () => {
		it("setBulk applies all settings in order", async () => {
			const results = await controller.setBulk([
				{ key: "general.store_name", value: "Bulk Shop" },
				{ key: "contact.email", value: "bulk@shop.com" },
				{ key: "commerce.currency", value: "EUR" },
			]);

			expect(results).toHaveLength(3);
			expect(await controller.getValue("general.store_name")).toBe("Bulk Shop");
			expect(await controller.getValue("contact.email")).toBe("bulk@shop.com");
			expect(await controller.getValue("commerce.currency")).toBe("EUR");
		});

		it("setBulk with duplicate keys uses last-write-wins", async () => {
			await controller.setBulk([
				{ key: "general.store_name", value: "First" },
				{ key: "general.store_name", value: "Second" },
				{ key: "general.store_name", value: "Third" },
			]);

			const value = await controller.getValue("general.store_name");
			expect(value).toBe("Third");

			// Only one record in the store
			const all = await controller.getAll();
			expect(all).toHaveLength(1);
		});

		it("setBulk does not affect pre-existing unrelated settings", async () => {
			await controller.set("general.existing", "untouched");

			await controller.setBulk([
				{ key: "contact.email", value: "new@shop.com" },
				{ key: "social.twitter", value: "@shop" },
			]);

			expect(await controller.getValue("general.existing")).toBe("untouched");
			const all = await controller.getAll();
			expect(all).toHaveLength(3);
		});

		it("empty setBulk does not corrupt existing state", async () => {
			await controller.set("general.store_name", "Keep Me");
			await controller.setBulk([]);

			expect(await controller.getValue("general.store_name")).toBe("Keep Me");
		});
	});

	// ── Delete Isolation ─────────────────────────────────────────────

	describe("delete isolation", () => {
		it("deleting one key does not affect others in the same group", async () => {
			await controller.set("contact.email", "a@b.com");
			await controller.set("contact.phone", "555-1234");
			await controller.set("contact.address", "123 Main St");

			await controller.delete("contact.phone");

			expect(await controller.getValue("contact.email")).toBe("a@b.com");
			expect(await controller.getValue("contact.phone")).toBeNull();
			expect(await controller.getValue("contact.address")).toBe("123 Main St");
		});

		it("deleting one key does not affect keys in other groups", async () => {
			await controller.set("general.store_name", "My Shop");
			await controller.set("commerce.currency", "USD");

			await controller.delete("commerce.currency");

			expect(await controller.getValue("general.store_name")).toBe("My Shop");
		});

		it("delete returns false for non-existent key (no side effects)", async () => {
			await controller.set("general.store_name", "Keep");
			const result = await controller.delete("general.nonexistent");
			expect(result).toBe(false);

			// Existing setting is unaffected
			expect(await controller.getValue("general.store_name")).toBe("Keep");
		});

		it("double-delete returns false on second attempt", async () => {
			await controller.set("general.key", "val");
			expect(await controller.delete("general.key")).toBe(true);
			expect(await controller.delete("general.key")).toBe(false);
		});

		it("deleted setting disappears from getPublic immediately", async () => {
			await controller.set("general.store_name", "Visible");
			const pubBefore = await controller.getPublic();
			expect(pubBefore["general.store_name"]).toBe("Visible");

			await controller.delete("general.store_name");

			const pubAfter = await controller.getPublic();
			expect(pubAfter["general.store_name"]).toBeUndefined();
		});

		it("deleted setting can be recreated with a new id", async () => {
			const original = await controller.set("general.key", "original");
			await controller.delete("general.key");
			const recreated = await controller.set("general.key", "recreated");

			expect(recreated.value).toBe("recreated");
			expect(recreated.id).not.toBe(original.id);
		});
	});

	// ── Data Store Integrity ─────────────────────────────────────────

	describe("data store integrity", () => {
		it("delete removes the record from the underlying store", async () => {
			const setting = await controller.set("general.key", "val");
			await controller.delete("general.key");

			const raw = await mockData.get("storeSetting", setting.id);
			expect(raw).toBeNull();
			expect(mockData.size("storeSetting")).toBe(0);
		});

		it("set uses the storeSetting entity type consistently", async () => {
			await controller.set("general.a", "1");
			await controller.set("contact.b", "2");

			expect(mockData.size("storeSetting")).toBe(2);
			// Verify no accidental entity type usage
			expect(mockData.size("setting")).toBe(0);
			expect(mockData.size("storeSettings")).toBe(0);
		});

		it("getAll after clearing the data store returns empty", async () => {
			await controller.set("general.a", "1");
			await controller.set("general.b", "2");
			expect(await controller.getAll()).toHaveLength(2);

			mockData.clear();
			expect(await controller.getAll()).toHaveLength(0);
			expect(await controller.getPublic()).toEqual({});
		});
	});
});
