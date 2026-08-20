import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSocialSharingController } from "../service-impl";

function defined<T>(val: T | null | undefined, label = "value"): T {
	if (val == null) throw new Error(`Expected ${label} to be defined`);
	return val;
}

describe("social-sharing service-impl", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let mockEvents: { emit: ReturnType<typeof vi.fn> };
	let controller: ReturnType<typeof createSocialSharingController>;

	beforeEach(() => {
		mockData = createMockDataService();
		mockEvents = { emit: vi.fn() };
		controller = createSocialSharingController(mockData, mockEvents as never);
	});

	// ── recordShare ─────────────────────────────────────────────────

	describe("recordShare", () => {
		it("creates a share event with all fields", async () => {
			const result = await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://store.example.com/products/prod-1",
				referrer: "https://google.com",
				sessionId: "sess-abc",
			});

			expect(result.id).toBeTruthy();
			expect(result.targetType).toBe("product");
			expect(result.targetId).toBe("prod-1");
			expect(result.network).toBe("twitter");
			expect(result.url).toBe("https://store.example.com/products/prod-1");
			expect(result.referrer).toBe("https://google.com");
			expect(result.sessionId).toBe("sess-abc");
			expect(result.createdAt).toBeInstanceOf(Date);
		});

		it("creates a share event without optional fields", async () => {
			const result = await controller.recordShare({
				targetType: "collection",
				targetId: "col-1",
				network: "facebook",
				url: "https://store.example.com/collections/col-1",
			});

			expect(result.id).toBeTruthy();
			expect(result.targetType).toBe("collection");
			expect(result.targetId).toBe("col-1");
			expect(result.network).toBe("facebook");
			expect(result.referrer).toBeUndefined();
			expect(result.sessionId).toBeUndefined();
		});

		it("persists the share event via data.upsert", async () => {
			const result = await controller.recordShare({
				targetType: "product",
				targetId: "prod-2",
				network: "linkedin",
				url: "https://store.example.com/products/prod-2",
			});

			const stored = await mockData.get("shareEvent", result.id);
			const event = defined(stored, "stored share event");
			expect((event as Record<string, unknown>).targetId).toBe("prod-2");
		});

		it("emits share.created event", async () => {
			const result = await controller.recordShare({
				targetType: "page",
				targetId: "page-1",
				network: "whatsapp",
				url: "https://store.example.com/pages/page-1",
			});

			expect(mockEvents.emit).toHaveBeenCalledWith("share.created", {
				shareEventId: result.id,
				targetType: "page",
				targetId: "page-1",
				network: "whatsapp",
			});
		});

		it("works without events emitter", async () => {
			const noEventsController = createSocialSharingController(mockData);
			const result = await noEventsController.recordShare({
				targetType: "product",
				targetId: "prod-3",
				network: "email",
				url: "https://store.example.com/products/prod-3",
			});

			expect(result.id).toBeTruthy();
			expect(result.network).toBe("email");
		});

		it("generates unique ids for each share", async () => {
			const first = await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://store.example.com/products/prod-1",
			});
			const second = await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://store.example.com/products/prod-1",
			});

			expect(first.id).not.toBe(second.id);
		});
	});

	// ── getShareCount ───────────────────────────────────────────────

	describe("getShareCount", () => {
		it("returns 0 when no shares exist", async () => {
			const count = await controller.getShareCount("product", "prod-1");
			expect(count).toBe(0);
		});

		it("counts shares for a specific target", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "facebook",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-2",
				network: "twitter",
				url: "https://example.com/p/2",
			});

			const count = await controller.getShareCount("product", "prod-1");
			expect(count).toBe(2);
		});

		it("does not count shares for different target types", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "id-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "collection",
				targetId: "id-1",
				network: "twitter",
				url: "https://example.com/c/1",
			});

			const count = await controller.getShareCount("product", "id-1");
			expect(count).toBe(1);
		});
	});

	// ── getShareCountByNetwork ──────────────────────────────────────

	describe("getShareCountByNetwork", () => {
		it("returns empty object when no shares exist", async () => {
			const counts = await controller.getShareCountByNetwork(
				"product",
				"prod-1",
			);
			expect(counts).toEqual({});
		});

		it("aggregates shares by network", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "facebook",
				url: "https://example.com/p/1",
			});

			const counts = await controller.getShareCountByNetwork(
				"product",
				"prod-1",
			);
			expect(counts).toEqual({ twitter: 2, facebook: 1 });
		});

		it("ignores shares for different targets", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-2",
				network: "linkedin",
				url: "https://example.com/p/2",
			});

			const counts = await controller.getShareCountByNetwork(
				"product",
				"prod-1",
			);
			expect(counts).toEqual({ twitter: 1 });
		});
	});

	// ── listShares ──────────────────────────────────────────────────

	describe("listShares", () => {
		it("returns all shares when called with no params", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "collection",
				targetId: "col-1",
				network: "facebook",
				url: "https://example.com/c/1",
			});

			const shares = await controller.listShares();
			expect(shares).toHaveLength(2);
		});

		it("filters by targetType", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "collection",
				targetId: "col-1",
				network: "facebook",
				url: "https://example.com/c/1",
			});

			const shares = await controller.listShares({
				targetType: "product",
			});
			expect(shares).toHaveLength(1);
			expect(shares[0].targetType).toBe("product");
		});

		it("filters by targetId", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-2",
				network: "twitter",
				url: "https://example.com/p/2",
			});

			const shares = await controller.listShares({
				targetId: "prod-1",
			});
			expect(shares).toHaveLength(1);
			expect(shares[0].targetId).toBe("prod-1");
		});

		it("filters by network", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "facebook",
				url: "https://example.com/p/1",
			});

			const shares = await controller.listShares({
				network: "twitter",
			});
			expect(shares).toHaveLength(1);
			expect(shares[0].network).toBe("twitter");
		});

		it("combines multiple filters", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "facebook",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "collection",
				targetId: "col-1",
				network: "twitter",
				url: "https://example.com/c/1",
			});

			const shares = await controller.listShares({
				targetType: "product",
				network: "twitter",
			});
			expect(shares).toHaveLength(1);
			expect(shares[0].targetType).toBe("product");
			expect(shares[0].network).toBe("twitter");
		});

		it("supports take parameter", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-2",
				network: "facebook",
				url: "https://example.com/p/2",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-3",
				network: "linkedin",
				url: "https://example.com/p/3",
			});

			const shares = await controller.listShares({ take: 2 });
			expect(shares).toHaveLength(2);
		});

		it("supports skip parameter", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-2",
				network: "facebook",
				url: "https://example.com/p/2",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-3",
				network: "linkedin",
				url: "https://example.com/p/3",
			});

			const shares = await controller.listShares({ skip: 1 });
			expect(shares).toHaveLength(2);
		});

		it("returns empty array when no matches", async () => {
			const shares = await controller.listShares({
				targetType: "product",
			});
			expect(shares).toEqual([]);
		});
	});

	// ── getTopShared ────────────────────────────────────────────────

	describe("getTopShared", () => {
		it("returns empty array when no shares exist", async () => {
			const top = await controller.getTopShared();
			expect(top).toEqual([]);
		});

		it("aggregates and sorts by count descending", async () => {
			// prod-1 gets 3 shares
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "facebook",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "linkedin",
				url: "https://example.com/p/1",
			});

			// prod-2 gets 1 share
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-2",
				network: "twitter",
				url: "https://example.com/p/2",
			});

			// col-1 gets 2 shares
			await controller.recordShare({
				targetType: "collection",
				targetId: "col-1",
				network: "twitter",
				url: "https://example.com/c/1",
			});
			await controller.recordShare({
				targetType: "collection",
				targetId: "col-1",
				network: "facebook",
				url: "https://example.com/c/1",
			});

			const top = await controller.getTopShared();
			expect(top).toHaveLength(3);
			expect(top[0]).toEqual({
				targetType: "product",
				targetId: "prod-1",
				count: 3,
			});
			expect(top[1]).toEqual({
				targetType: "collection",
				targetId: "col-1",
				count: 2,
			});
			expect(top[2]).toEqual({
				targetType: "product",
				targetId: "prod-2",
				count: 1,
			});
		});

		it("defaults take to 10", async () => {
			// Create 12 distinct targets
			for (let i = 0; i < 12; i++) {
				await controller.recordShare({
					targetType: "product",
					targetId: `prod-${i}`,
					network: "twitter",
					url: `https://example.com/p/${i}`,
				});
			}

			const top = await controller.getTopShared();
			expect(top).toHaveLength(10);
		});

		it("respects custom take parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.recordShare({
					targetType: "product",
					targetId: `prod-${i}`,
					network: "twitter",
					url: `https://example.com/p/${i}`,
				});
			}

			const top = await controller.getTopShared({ take: 3 });
			expect(top).toHaveLength(3);
		});

		it("filters by targetType", async () => {
			await controller.recordShare({
				targetType: "product",
				targetId: "prod-1",
				network: "twitter",
				url: "https://example.com/p/1",
			});
			await controller.recordShare({
				targetType: "collection",
				targetId: "col-1",
				network: "twitter",
				url: "https://example.com/c/1",
			});

			const top = await controller.getTopShared({
				targetType: "product",
			});
			expect(top).toHaveLength(1);
			expect(top[0].targetType).toBe("product");
		});
	});

	// ── getSettings ─────────────────────────────────────────────────

	describe("getSettings", () => {
		it("returns null when no settings exist", async () => {
			const settings = await controller.getSettings();
			expect(settings).toBeNull();
		});

		it("returns settings after they are created", async () => {
			await controller.updateSettings({
				enabledNetworks: ["twitter", "facebook"],
			});

			const settings = await controller.getSettings();
			const result = defined(settings, "settings");
			expect(result.enabledNetworks).toEqual(["twitter", "facebook"]);
		});
	});

	// ── updateSettings ──────────────────────────────────────────────

	describe("updateSettings", () => {
		it("creates settings with enabledNetworks", async () => {
			const settings = await controller.updateSettings({
				enabledNetworks: ["twitter", "facebook", "linkedin"],
			});

			expect(settings.id).toBe("global");
			expect(settings.enabledNetworks).toEqual([
				"twitter",
				"facebook",
				"linkedin",
			]);
			expect(settings.hashtags).toEqual([]);
			expect(settings.customTemplates).toEqual({});
			expect(settings.updatedAt).toBeInstanceOf(Date);
		});

		it("creates settings with defaultMessage", async () => {
			const settings = await controller.updateSettings({
				defaultMessage: "Check out this product!",
			});

			expect(settings.defaultMessage).toBe("Check out this product!");
		});

		it("creates settings with hashtags", async () => {
			const settings = await controller.updateSettings({
				hashtags: ["sale", "newproduct"],
			});

			expect(settings.hashtags).toEqual(["sale", "newproduct"]);
		});

		it("creates settings with customTemplates", async () => {
			const settings = await controller.updateSettings({
				customTemplates: {
					twitter: "Buy {name} now!",
					facebook: "Discover {name}",
				},
			});

			expect(settings.customTemplates).toEqual({
				twitter: "Buy {name} now!",
				facebook: "Discover {name}",
			});
		});

		it("merges with existing settings", async () => {
			await controller.updateSettings({
				enabledNetworks: ["twitter"],
				defaultMessage: "Original message",
				hashtags: ["original"],
			});

			const updated = await controller.updateSettings({
				enabledNetworks: ["twitter", "facebook"],
			});

			expect(updated.enabledNetworks).toEqual(["twitter", "facebook"]);
			expect(updated.defaultMessage).toBe("Original message");
			expect(updated.hashtags).toEqual(["original"]);
		});

		it("overwrites fields when explicitly provided", async () => {
			await controller.updateSettings({
				enabledNetworks: ["twitter"],
				defaultMessage: "Old message",
			});

			const updated = await controller.updateSettings({
				defaultMessage: "New message",
			});

			expect(updated.defaultMessage).toBe("New message");
			expect(updated.enabledNetworks).toEqual(["twitter"]);
		});

		it("defaults enabledNetworks to empty array on first create", async () => {
			const settings = await controller.updateSettings({
				defaultMessage: "Hello",
			});

			expect(settings.enabledNetworks).toEqual([]);
		});

		it("defaults customTemplates to empty object on first create", async () => {
			const settings = await controller.updateSettings({
				hashtags: ["test"],
			});

			expect(settings.customTemplates).toEqual({});
		});

		it("emits share.settings.updated event", async () => {
			await controller.updateSettings({
				enabledNetworks: ["twitter", "whatsapp"],
			});

			expect(mockEvents.emit).toHaveBeenCalledWith("share.settings.updated", {
				enabledNetworks: ["twitter", "whatsapp"],
			});
		});

		it("persists settings for retrieval", async () => {
			await controller.updateSettings({
				enabledNetworks: ["pinterest"],
				defaultMessage: "Pin this!",
				hashtags: ["pinit"],
				customTemplates: { pinterest: "Love this {name}" },
			});

			const retrieved = await controller.getSettings();
			const result = defined(retrieved, "retrieved settings");
			expect(result.enabledNetworks).toEqual(["pinterest"]);
			expect(result.defaultMessage).toBe("Pin this!");
			expect(result.hashtags).toEqual(["pinit"]);
			expect(result.customTemplates).toEqual({
				pinterest: "Love this {name}",
			});
		});
	});

	// ── generateShareUrl ────────────────────────────────────────────

	describe("generateShareUrl", () => {
		const targetUrl = "https://store.example.com/products/widget";

		describe("twitter", () => {
			it("generates a basic twitter share URL", () => {
				const url = controller.generateShareUrl("twitter", targetUrl);
				expect(url).toBe(
					`https://twitter.com/intent/tweet?url=${encodeURIComponent(targetUrl)}`,
				);
			});

			it("includes text when message is provided", () => {
				const url = controller.generateShareUrl(
					"twitter",
					targetUrl,
					"Check this out",
				);
				expect(url).toContain(`&text=${encodeURIComponent("Check this out")}`);
			});

			it("includes hashtags when provided", () => {
				const url = controller.generateShareUrl(
					"twitter",
					targetUrl,
					undefined,
					["sale", "deals"],
				);
				expect(url).toContain(`&hashtags=${encodeURIComponent("sale,deals")}`);
			});

			it("includes both text and hashtags", () => {
				const url = controller.generateShareUrl(
					"twitter",
					targetUrl,
					"Great deal",
					["sale"],
				);
				expect(url).toContain(`url=${encodeURIComponent(targetUrl)}`);
				expect(url).toContain(`&text=${encodeURIComponent("Great deal")}`);
				expect(url).toContain(`&hashtags=${encodeURIComponent("sale")}`);
			});

			it("omits hashtags param when array is empty", () => {
				const url = controller.generateShareUrl(
					"twitter",
					targetUrl,
					"Hello",
					[],
				);
				expect(url).not.toContain("hashtags");
			});
		});

		describe("facebook", () => {
			it("generates a facebook share URL", () => {
				const url = controller.generateShareUrl("facebook", targetUrl);
				expect(url).toBe(
					`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}`,
				);
			});

			it("ignores message and hashtags", () => {
				const url = controller.generateShareUrl(
					"facebook",
					targetUrl,
					"Some message",
					["tag"],
				);
				expect(url).toBe(
					`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}`,
				);
			});
		});

		describe("pinterest", () => {
			it("generates a basic pinterest share URL", () => {
				const url = controller.generateShareUrl("pinterest", targetUrl);
				expect(url).toBe(
					`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(targetUrl)}`,
				);
			});

			it("includes description when message is provided", () => {
				const url = controller.generateShareUrl(
					"pinterest",
					targetUrl,
					"Beautiful widget",
				);
				expect(url).toContain(
					`&description=${encodeURIComponent("Beautiful widget")}`,
				);
			});
		});

		describe("linkedin", () => {
			it("generates a linkedin share URL", () => {
				const url = controller.generateShareUrl("linkedin", targetUrl);
				expect(url).toBe(
					`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(targetUrl)}`,
				);
			});
		});

		describe("whatsapp", () => {
			it("generates a whatsapp URL with just the target URL", () => {
				const url = controller.generateShareUrl("whatsapp", targetUrl);
				expect(url).toBe(
					`https://api.whatsapp.com/send?text=${encodeURIComponent(targetUrl)}`,
				);
			});

			it("prepends message to the URL", () => {
				const url = controller.generateShareUrl(
					"whatsapp",
					targetUrl,
					"Look at this",
				);
				expect(url).toBe(
					`https://api.whatsapp.com/send?text=${encodeURIComponent("Look at this")} ${encodeURIComponent(targetUrl)}`,
				);
			});
		});

		describe("email", () => {
			it("generates a mailto URL with default subject", () => {
				const url = controller.generateShareUrl("email", targetUrl);
				expect(url).toBe(
					`mailto:?subject=${encodeURIComponent("Check this out")}&body=${encodeURIComponent(targetUrl)}`,
				);
			});

			it("uses message as subject when provided", () => {
				const url = controller.generateShareUrl(
					"email",
					targetUrl,
					"You'll love this",
				);
				expect(url).toBe(
					`mailto:?subject=${encodeURIComponent("You'll love this")}&body=${encodeURIComponent(targetUrl)}`,
				);
			});
		});

		describe("copy-link", () => {
			it("returns the target URL as-is", () => {
				const url = controller.generateShareUrl("copy-link", targetUrl);
				expect(url).toBe(targetUrl);
			});

			it("ignores message and hashtags", () => {
				const url = controller.generateShareUrl(
					"copy-link",
					targetUrl,
					"Some message",
					["tag"],
				);
				expect(url).toBe(targetUrl);
			});
		});

		describe("URL encoding", () => {
			it("encodes special characters in the target URL", () => {
				const specialUrl =
					"https://store.example.com/products?id=1&name=hello world";
				const url = controller.generateShareUrl("twitter", specialUrl);
				expect(url).toContain(encodeURIComponent(specialUrl));
			});

			it("encodes special characters in the message", () => {
				const url = controller.generateShareUrl(
					"twitter",
					targetUrl,
					"50% off & free shipping!",
				);
				expect(url).toContain(encodeURIComponent("50% off & free shipping!"));
			});
		});
	});
});
