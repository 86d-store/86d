import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSettingsController } from "../service-impl";

describe("createSettingsController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSettingsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSettingsController(mockData);
	});

	// ── set ──────────────────────────────────────────────────────────────

	describe("set", () => {
		it("creates a new setting", async () => {
			const setting = await controller.set(
				"general.store_name",
				"My Store",
				"general",
			);
			expect(setting.key).toBe("general.store_name");
			expect(setting.value).toBe("My Store");
			expect(setting.group).toBe("general");
			expect(setting.id).toBeDefined();
			expect(setting.updatedAt).toBeInstanceOf(Date);
		});

		it("updates an existing setting by key", async () => {
			await controller.set("general.store_name", "Store A", "general");
			const updated = await controller.set(
				"general.store_name",
				"Store B",
				"general",
			);
			expect(updated.value).toBe("Store B");
		});

		it("preserves id when updating", async () => {
			const original = await controller.set(
				"general.store_name",
				"Store A",
				"general",
			);
			const updated = await controller.set(
				"general.store_name",
				"Store B",
				"general",
			);
			expect(updated.id).toBe(original.id);
		});

		it("infers group from key prefix", async () => {
			const setting = await controller.set("contact.support_email", "a@b.com");
			expect(setting.group).toBe("contact");
		});

		it("infers social group from key prefix", async () => {
			const setting = await controller.set(
				"social.twitter",
				"https://twitter.com/store",
			);
			expect(setting.group).toBe("social");
		});

		it("infers legal group from key prefix", async () => {
			const setting = await controller.set(
				"legal.privacy_policy",
				"Our policy...",
			);
			expect(setting.group).toBe("legal");
		});

		it("infers commerce group from key prefix", async () => {
			const setting = await controller.set("commerce.currency", "USD");
			expect(setting.group).toBe("commerce");
		});

		it("infers appearance group from key prefix", async () => {
			const setting = await controller.set("appearance.logo_url", "/logo.png");
			expect(setting.group).toBe("appearance");
		});

		it("defaults to general group for unknown prefix", async () => {
			const setting = await controller.set("unknown.key", "value");
			expect(setting.group).toBe("general");
		});

		it("defaults to general group for key without prefix", async () => {
			const setting = await controller.set("noprefix", "value");
			expect(setting.group).toBe("general");
		});

		it("explicit group overrides inferred group", async () => {
			const setting = await controller.set(
				"contact.email",
				"a@b.com",
				"general",
			);
			expect(setting.group).toBe("general");
		});

		it("handles empty string value", async () => {
			const setting = await controller.set("general.store_name", "", "general");
			expect(setting.value).toBe("");
		});

		it("handles long values", async () => {
			const longValue = "x".repeat(10000);
			const setting = await controller.set("legal.terms", longValue, "legal");
			expect(setting.value).toBe(longValue);
		});
	});

	// ── get ──────────────────────────────────────────────────────────────

	describe("get", () => {
		it("returns null for non-existent setting", async () => {
			const result = await controller.get("nonexistent.key");
			expect(result).toBeNull();
		});

		it("returns the setting by key", async () => {
			await controller.set("general.store_name", "Test Store", "general");
			const result = await controller.get("general.store_name");
			expect(result).not.toBeNull();
			expect(result?.value).toBe("Test Store");
		});
	});

	// ── getValue ─────────────────────────────────────────────────────────

	describe("getValue", () => {
		it("returns null for non-existent key", async () => {
			const result = await controller.getValue("nonexistent.key");
			expect(result).toBeNull();
		});

		it("returns the value string", async () => {
			await controller.set("general.store_name", "My Store", "general");
			const value = await controller.getValue("general.store_name");
			expect(value).toBe("My Store");
		});
	});

	// ── setBulk ──────────────────────────────────────────────────────────

	describe("setBulk", () => {
		it("sets multiple settings at once", async () => {
			const results = await controller.setBulk([
				{ key: "general.store_name", value: "Bulk Store" },
				{ key: "contact.support_email", value: "bulk@test.com" },
				{ key: "social.facebook", value: "https://facebook.com/bulk" },
			]);
			expect(results).toHaveLength(3);
			expect(results[0].key).toBe("general.store_name");
			expect(results[1].key).toBe("contact.support_email");
			expect(results[2].key).toBe("social.facebook");
		});

		it("updates existing settings in bulk", async () => {
			await controller.set("general.store_name", "Old Name");
			const results = await controller.setBulk([
				{ key: "general.store_name", value: "New Name" },
			]);
			expect(results[0].value).toBe("New Name");
		});

		it("handles mixed create and update in bulk", async () => {
			await controller.set("general.store_name", "Existing");
			const results = await controller.setBulk([
				{ key: "general.store_name", value: "Updated" },
				{ key: "contact.phone", value: "555-0000" },
			]);
			expect(results).toHaveLength(2);
			expect(results[0].value).toBe("Updated");
			expect(results[1].key).toBe("contact.phone");
			expect(results[1].value).toBe("555-0000");
		});

		it("infers groups for each setting", async () => {
			const results = await controller.setBulk([
				{ key: "contact.phone", value: "555" },
				{ key: "legal.tos", value: "terms" },
			]);
			expect(results[0].group).toBe("contact");
			expect(results[1].group).toBe("legal");
		});

		it("respects explicit group in bulk", async () => {
			const results = await controller.setBulk([
				{ key: "custom.key", value: "val", group: "commerce" },
			]);
			expect(results[0].group).toBe("commerce");
		});

		it("returns empty array for empty input", async () => {
			const results = await controller.setBulk([]);
			expect(results).toEqual([]);
		});
	});

	// ── getByGroup ───────────────────────────────────────────────────────

	describe("getByGroup", () => {
		it("returns empty array for group with no settings", async () => {
			const results = await controller.getByGroup("social");
			expect(results).toEqual([]);
		});

		it("returns only settings from the specified group", async () => {
			await controller.set("general.store_name", "Store", "general");
			await controller.set("contact.support_email", "a@b.com", "contact");
			await controller.set("contact.support_phone", "555-1234", "contact");

			const contactSettings = await controller.getByGroup("contact");
			expect(contactSettings).toHaveLength(2);
			for (const s of contactSettings) {
				expect(s.group).toBe("contact");
			}
		});

		it("does not return settings from other groups", async () => {
			await controller.set("general.store_name", "Store", "general");
			await controller.set("commerce.currency", "USD", "commerce");
			await controller.set("legal.tos", "Terms", "legal");

			const general = await controller.getByGroup("general");
			expect(general).toHaveLength(1);
			expect(general[0].key).toBe("general.store_name");
		});

		it("works for each valid group type", async () => {
			await controller.set("general.a", "1", "general");
			await controller.set("contact.a", "2", "contact");
			await controller.set("social.a", "3", "social");
			await controller.set("legal.a", "4", "legal");
			await controller.set("commerce.a", "5", "commerce");
			await controller.set("appearance.a", "6", "appearance");

			expect(await controller.getByGroup("general")).toHaveLength(1);
			expect(await controller.getByGroup("contact")).toHaveLength(1);
			expect(await controller.getByGroup("social")).toHaveLength(1);
			expect(await controller.getByGroup("legal")).toHaveLength(1);
			expect(await controller.getByGroup("commerce")).toHaveLength(1);
			expect(await controller.getByGroup("appearance")).toHaveLength(1);
		});
	});

	// ── getAll ────────────────────────────────────────────────────────────

	describe("getAll", () => {
		it("returns all settings", async () => {
			await controller.set("general.store_name", "Store", "general");
			await controller.set("contact.support_email", "a@b.com", "contact");

			const all = await controller.getAll();
			expect(all).toHaveLength(2);
		});

		it("returns empty array when no settings exist", async () => {
			const all = await controller.getAll();
			expect(all).toEqual([]);
		});
	});

	// ── getPublic ─────────────────────────────────────────────────────────

	describe("getPublic", () => {
		it("returns only public settings", async () => {
			await controller.set("general.store_name", "Public Store", "general");
			await controller.set("contact.support_email", "pub@test.com", "contact");
			await controller.set("social.facebook", "https://fb.com/s", "social");
			await controller.set("commerce.currency", "USD", "commerce");
			await controller.set("legal.return_policy", "No returns", "legal");

			const pub = await controller.getPublic();
			expect(pub["general.store_name"]).toBe("Public Store");
			expect(pub["contact.support_email"]).toBe("pub@test.com");
			expect(pub["social.facebook"]).toBe("https://fb.com/s");
			// commerce and legal are not public
			expect(pub["commerce.currency"]).toBeUndefined();
			expect(pub["legal.return_policy"]).toBeUndefined();
		});

		it("includes appearance settings in public", async () => {
			await controller.set("appearance.brand_color", "#ff0000", "appearance");
			const pub = await controller.getPublic();
			expect(pub["appearance.brand_color"]).toBe("#ff0000");
		});

		it("returns empty object when no settings exist", async () => {
			const pub = await controller.getPublic();
			expect(pub).toEqual({});
		});
	});

	// ── delete ────────────────────────────────────────────────────────────

	describe("delete", () => {
		it("returns false for non-existent setting", async () => {
			const result = await controller.delete("nonexistent.key");
			expect(result).toBe(false);
		});

		it("deletes an existing setting", async () => {
			await controller.set("general.store_name", "To Delete", "general");
			const deleted = await controller.delete("general.store_name");
			expect(deleted).toBe(true);

			const result = await controller.get("general.store_name");
			expect(result).toBeNull();
		});

		it("does not affect other settings when deleting", async () => {
			await controller.set("general.store_name", "Keep", "general");
			await controller.set("general.description", "Delete me", "general");
			await controller.delete("general.description");

			const name = await controller.get("general.store_name");
			expect(name?.value).toBe("Keep");
		});

		it("allows re-creating a deleted setting", async () => {
			await controller.set("general.store_name", "Original", "general");
			await controller.delete("general.store_name");
			const recreated = await controller.set(
				"general.store_name",
				"New",
				"general",
			);
			expect(recreated.value).toBe("New");
		});
	});

	// ── full lifecycle ────────────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("set → get → update → getPublic → delete", async () => {
			// Create
			await controller.set("general.store_name", "My Shop", "general");
			const got = await controller.get("general.store_name");
			expect(got?.value).toBe("My Shop");

			// Update
			await controller.set("general.store_name", "New Shop", "general");
			const val = await controller.getValue("general.store_name");
			expect(val).toBe("New Shop");

			// Visible in public
			const pub = await controller.getPublic();
			expect(pub["general.store_name"]).toBe("New Shop");

			// Delete
			const deleted = await controller.delete("general.store_name");
			expect(deleted).toBe(true);

			// Gone from public
			const pubAfter = await controller.getPublic();
			expect(pubAfter["general.store_name"]).toBeUndefined();
		});

		it("bulk set across groups then filter", async () => {
			await controller.setBulk([
				{ key: "general.store_name", value: "Shop" },
				{ key: "contact.email", value: "a@b.com" },
				{ key: "commerce.currency", value: "EUR" },
				{ key: "legal.tos", value: "Terms" },
				{ key: "social.instagram", value: "https://ig.com" },
				{ key: "appearance.theme", value: "dark" },
			]);

			const all = await controller.getAll();
			expect(all).toHaveLength(6);

			// Public should include general, contact, social, appearance (4)
			const pub = await controller.getPublic();
			expect(Object.keys(pub)).toHaveLength(4);
			expect(pub["commerce.currency"]).toBeUndefined();
			expect(pub["legal.tos"]).toBeUndefined();
		});

		it("getValue returns null after delete", async () => {
			await controller.set("general.key", "val");
			expect(await controller.getValue("general.key")).toBe("val");
			await controller.delete("general.key");
			expect(await controller.getValue("general.key")).toBeNull();
		});
	});
});
